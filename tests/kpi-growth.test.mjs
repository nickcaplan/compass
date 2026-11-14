import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
import {seedPlannerFixture} from './planner-auth-fixture.mjs';

test('Objective stays above animated KPI growth; name/market stay put; reduced motion and responsive state are retained', {timeout:60000}, async () => {
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0']);
  let browser;
  try {
    const url=await new Promise((resolve,reject)=>{
      let output='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);
      server.once('error',reject);
      server.stdout.on('data',chunk=>{output+=stripVTControlCharacters(chunk.toString());const match=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}});
    });
    browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
    for (const width of [390,768,1280,1440,1920]) for (const reduce of [false,true]) {
      const context=await browser.createBrowserContext(),page=await context.newPage();
      await seedPlannerFixture(page);await page.setViewport({width,height:1000});
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]);
      await page.goto(url+'#/planner');await page.waitForSelector('.avatar');await page.evaluate(()=>document.fonts.ready);
      await page.locator('#f-name').fill('Preserved campaign');
      const measure=()=>page.evaluate(()=>({height:document.querySelector('.kpi-field').getBoundingClientRect().height,audience:document.querySelector('[aria-labelledby=g-audience]').getBoundingClientRect().y,market:document.querySelector('[aria-labelledby=g-market]').getBoundingClientRect().y}));
      if(width>=1200)await page.waitForFunction(()=>{
        const left=document.querySelector('.brief-details').getBoundingClientRect(),right=document.querySelector('.brief-goals').getBoundingClientRect();
        return Math.abs(left.bottom-right.bottom)<1&&!document.querySelector('.kpi-field').getAnimations().some(a=>a.playState==='running');
      });
      const before=await measure();
      if(width>=1200){
        const balance=await page.evaluate(()=>{
          const left=document.querySelector('.brief-details').getBoundingClientRect();
          const right=document.querySelector('.brief-goals').getBoundingClientRect();
          return {gap:Math.abs(left.bottom-right.bottom),audience:document.querySelector('.brief-audience').getBoundingClientRect().top,bottom:Math.max(left.bottom,right.bottom)};
        });
        assert.ok(balance.gap<1,`${width}: empty KPI bottom aligns exactly with Market`);
        assert.ok(balance.audience>=balance.bottom&&balance.audience-balance.bottom<24);
      }
      for (let objective=1;objective<=3;objective++) {
        const previous=await measure();
        await page.locator(`[aria-labelledby=g-objective] button:nth-child(${objective})`).click();
        if (!reduce && !(width>=1200 && objective===1)) {
          await page.waitForFunction(()=>document.querySelector('.kpi-field').getAnimations().some(a=>a.playState==='running'));
          const midpoint=await page.$eval('.kpi-field',e=>{
            const animation=e.getAnimations()[0];animation.pause();animation.currentTime=140;
            const height=e.getBoundingClientRect().height;const frames=animation.effect.getKeyframes();
            const from=parseFloat(frames[0].height),to=parseFloat(frames[1].height);animation.finish();
            return {height,from,to};
          });
          assert.ok(midpoint.to>midpoint.from,`${width}: objective ${objective} grows`);
          assert.ok(midpoint.height>midpoint.from&&midpoint.height<midpoint.to,`${width}: actual intermediate height`);
        }
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        if (reduce) assert.equal(await page.$eval('.kpi-field',e=>e.getAnimations().length),0,'reduced motion has no height animation');
        const after=await measure();assert.ok(after.height>=previous.height,`${width}: never shrinks for additional objective`);
        if(width>=1200){assert.equal(after.market,before.market);
          const layout=await page.evaluate(()=>{
            const left=document.querySelector('.brief-details').getBoundingClientRect(),right=document.querySelector('.brief-goals').getBoundingClientRect();
            const audience=document.querySelector('.brief-audience').getBoundingClientRect();
            return {gap:Math.abs(left.bottom-right.bottom),audience:audience.top,bottom:Math.max(left.bottom,right.bottom)};
          });
          assert.ok(layout.gap<140,`${width}: partial/full objective columns stay balanced`);
          assert.ok(layout.audience>=layout.bottom&&layout.audience-layout.bottom<24);
        }
      }
      assert.equal(await page.$$eval('[aria-labelledby=g-kpi] button',bs=>bs.length),19);
      // Removing an objective gently shrinks and removes its selected KPI only.
      await page.locator('[aria-labelledby=g-kpi] button').click();
      await page.locator('[aria-labelledby=g-objective] button:nth-child(1)').click();
      await page.evaluate(()=>Promise.all(document.querySelector('.kpi-field').getAnimations().map(a=>a.finished.catch(()=>{}))));
      assert.equal(await page.$$eval('[aria-labelledby=g-kpi] [aria-pressed=true]',bs=>bs.length),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.setViewport({width:width>=1200?390:1440,height:1000});
      await page.waitForFunction(w=>Boolean(document.querySelector('.brief-columns'))===(w>=1200),{},width>=1200?390:1440);
      assert.equal(await page.$eval('#f-name',e=>e.value),'Preserved campaign');
      // The arrow must remain on the final word's line, even at 200% text.
      await page.evaluate(()=>{
        const sizes=[...document.querySelectorAll('*')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);
        for(const [e,size] of sizes)e.style.fontSize=`${size*2}px`;
      });
      const tail=await page.$eval('.gen-tail',e=>{
        const word=document.createRange();word.setStart(e.firstChild,0);word.setEnd(e.firstChild,4);
        const arrow=e.querySelector('.gen-arrow').getBoundingClientRect();
        return {wordTop:word.getBoundingClientRect().top,arrowTop:arrow.top};
      });
      assert.ok(Math.abs(tail.wordTop-tail.arrowTop)<2,`${width}: enlarged CTA arrow stays beside plan`);
      assert.equal(await page.$$eval('[aria-labelledby=g-objective] [aria-pressed=true]',bs=>bs.length),2);
      await context.close();
    }
  } finally { await browser?.close();server.kill(); }
});
