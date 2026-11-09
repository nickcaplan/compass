import {stripVTControlCharacters} from 'node:util';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

test('PDF gold feedback preserves layout, text and dismissal in generated and saved views', { timeout: 60000 }, async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  let browser;
  try {
    // Use only the URL announced by this child, never an unrelated process.
    const previewUrl = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Preview server did not become ready')), 10000);
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited early: ${code}`)); });
      server.stdout.on('data', chunk => {
        output += chunk.toString();
        const match = stripVTControlCharacters(output).match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      });
    });
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
    for (const width of [320, 390, 1440]) {
      const context = await browser.createBrowserContext();const page = await context.newPage(); await page.setViewport({width,height:900});
      await page.evaluateOnNewDocument(()=>localStorage.setItem('sb-ctailpmcoyvaplwbwskf-auth-token',JSON.stringify({access_token:'test',refresh_token:'test',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'pdf-test',email:'pdf@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{full_name:'PDF Test',compass_profile_complete:true}}})));await page.goto(previewUrl+'?demo=1'); await page.waitForSelector('.demofill'); await page.locator('.demofill').click();
      await page.waitForFunction(()=>!document.querySelector('.gen').disabled); await page.evaluate(()=>document.querySelector('.gen').click()); await page.waitForSelector('.cs-wrap button');
      for (const saved of [false,true]) {
        if(saved){await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save plan').click());await page.waitForSelector('.bsum');}
        await page.$eval('.cs-wrap button',e=>e.scrollIntoView({block:'center'}));
        // The plan reveal settles for a moment after generation; only measure once the layout is still.
        await page.waitForFunction(()=>new Promise(res=>{const e=document.querySelector('.cs-wrap');const a=e.getBoundingClientRect().top+scrollY;setTimeout(()=>res(Math.abs(e.getBoundingClientRect().top+scrollY-a)<0.5),600)}),{polling:200});
        const button=await page.$eval('.cs-wrap button',e=>({width:e.offsetWidth,height:e.offsetHeight,left:e.offsetLeft,top:e.offsetTop}));
        const nextTop=await page.evaluate(()=>{const n=document.querySelector('.cs-wrap').nextElementSibling;return n?n.offsetTop:null});
        const wrapPos=await page.evaluate(()=>{const r=document.querySelector('.cs-wrap').getBoundingClientRect();return {x:r.left,y:r.top+scrollY}});
        assert.equal(await page.$eval('.cs-wrap button',e=>e.getAttribute('aria-label')),'Download PDF');if(!saved)assert.equal(await page.$eval('.cs-label',e=>e.textContent.trim()),'Download PDF');
        await page.locator('.cs-wrap button').click();
        // The button itself becomes the status: label swaps in place.
        await page.waitForFunction(()=>document.querySelector('.cs-wrap').classList.contains('cs-showing'));
        await page.waitForFunction(()=>{const e=document.querySelector('.cs-label');const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.visibility==='visible'&&Number(c.opacity)>.9&&r.width>0&&r.height>0});
        // No layout shift: the button box and the following action never move.
        assert.deepEqual(await page.$eval('.cs-wrap button',e=>({width:e.offsetWidth,height:e.offsetHeight,left:e.offsetLeft,top:e.offsetTop})),button);
        assert.equal(await page.evaluate(()=>{const n=document.querySelector('.cs-wrap').nextElementSibling;return n?n.offsetTop:null}),nextTop);
        assert.deepEqual(await page.evaluate(()=>{const r=document.querySelector('.cs-wrap').getBoundingClientRect();return {x:r.left,y:r.top+scrollY}}),wrapPos);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.cs-wrap').classList.contains('cs-showing'));
        await page.locator('.cs-wrap button').click();
        await new Promise(resolve=>setTimeout(resolve,450));
        const focused=await page.$('.cs-wrap button');
        await page.locator('.cs-wrap button').click();
        const washTime=await page.$eval('.cs-wrap button',e=>e.getAnimations()[0]?.currentTime);
        assert.ok(washTime!==undefined && washTime<200,'Repeated activation restarts wash');
        assert.equal(await focused.evaluate(e=>e===document.activeElement),true,'Focused button is preserved');
        await page.keyboard.press('Escape');
        const start=await page.evaluate(()=>{document.querySelector('.cs-wrap button').click();return performance.now()});await page.waitForFunction(()=>document.querySelector('.cs-wrap').classList.contains('cs-showing'));await page.waitForFunction(()=>!document.querySelector('.cs-wrap').classList.contains('cs-showing'));const elapsed=await page.evaluate(t=>performance.now()-t,start);assert.ok(elapsed>=900&&elapsed<=1600,`feedback lasted ${elapsed}ms`);
      }
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.locator('.cs-wrap button').click();await page.waitForFunction(()=>document.querySelector('.cs-wrap').classList.contains('cs-showing'));assert.equal(await page.$eval('.cs-wrap .ghost',e=>e.getAnimations().length),0);assert.equal(await page.$eval('.cs-wrap .ghost',e=>getComputedStyle(e).transitionDuration),'0s');await page.keyboard.press('Escape');assert.equal(await page.$eval('.cs-wrap .ghost',e=>getComputedStyle(e).transitionDuration),'0s');await context.close();
    }
  } finally { await browser?.close(); server.kill(); }
});
