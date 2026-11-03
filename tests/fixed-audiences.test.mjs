import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
const expected=['Procurement','Laboratory Manager','Laboratory Technician','Scientist / Researcher','Purchasing Manager','Quality / Compliance'];

test('natural audience pills stay consistent and invalid saved choices require a current audience with persisted demo cleanup', {timeout:120000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const url=process.env.HOSTED_URL || await new Promise((resolve,reject)=>{
   let out='';const timer=setTimeout(()=>reject(Error('Preview not ready')),10000);
   server.once('error',reject);server.stdout.on('data',b=>{out+=b;const m=stripVTControlCharacters(out).match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}});
  });
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true});
  for(const width of[320,375,390,414,768,980,981,1200,1440]) {
   const ctx=await browser.createBrowserContext(),p=await ctx.newPage();await p.setViewport({width,height:900});p.setDefaultTimeout(7000);
   await p.goto(url+'?demo=1');await p.waitForSelector('[aria-labelledby=g-audience]');await p.evaluate(()=>document.fonts.ready);
   const labels=()=>p.$$eval('[aria-labelledby=g-audience] button',bs=>bs.map(b=>b.textContent.trim()));assert.deepEqual(await labels(),expected);
   const geometry=()=>p.$$eval('[aria-labelledby=g-audience] button',bs=>bs.map(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return {x:r.x,y:r.y,width:r.width,height:r.height,font:parseFloat(s.fontSize),overflow:b.scrollWidth>b.clientWidth}}));
   for(const theme of['dark','light']) {
    await p.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
    const g=await geometry();assert.ok(g.every(x=>x.font>=13&&!x.overflow));
    const consistency=await p.$$eval('[aria-labelledby=g-audience] button',bs=>{
     const reference=getComputedStyle(document.querySelector('[aria-labelledby=g-objective] button'));
     return bs.every(b=>{const s=getComputedStyle(b);return ['fontSize','fontFamily','padding','borderRadius','lineHeight'].every(k=>s[k]===reference[k])&&b.getBoundingClientRect().height===document.querySelector('[aria-labelledby=g-objective] button').getBoundingClientRect().height});
    });assert.equal(consistency,true);
    // Full labels remain single-line. Natural flex wrapping pairs only where
    // the unmodified shared pill dimensions fit in the current card.
    assert.ok(g.every(x=>x.height===g[0].height));
    const available=await p.$eval('[aria-labelledby=g-audience]',e=>e.clientWidth);
    if(g[2].width+g[3].width+8<=available)assert.equal(g[2].y,g[3].y);
    else assert.ok(g[2].y<g[3].y);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.SCREENSHOT_DIR){await p.$eval('[aria-labelledby=g-audience]',e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:`${process.env.SCREENSHOT_DIR}/audience-pairs-${process.env.HOSTED_URL?'hosted':'local'}-${width}-${theme}.png`})}
   }
   // Fallback font remains readable without clipping at normal label size.
   await p.addStyleTag({content:'.audience-pills .pill{font-family:Arial,sans-serif;font-size:13px}'});
   assert.ok((await geometry()).every(x=>!x.overflow));
   await p.reload();await p.waitForSelector('[aria-labelledby=g-audience]');
   await p.locator('[aria-labelledby=g-audience] button').click();await p.keyboard.press('Space');assert.equal(await p.$eval('[aria-labelledby=g-audience] button',e=>e.getAttribute('aria-pressed')),'false');await p.keyboard.press('Space');assert.equal(await p.$eval('[aria-labelledby=g-audience] button',e=>e.getAttribute('aria-pressed')),'true');
   const futureDate=days=>{const date=new Date();date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
   const old={id:'legacy',savedAt:new Date().toISOString(),brief:{name:'Legacy R&D',objectives:['awareness'],kpis:['Reach'],audiences:['R&D','Department Head'],seniority:['Manager'],budget:10000,start:futureDate(30),end:futureDate(90)}};
   await p.evaluate(plan=>localStorage.setItem('compass-saved-plans',JSON.stringify([plan])),old);await p.reload();await p.waitForSelector('.themebtn');
   const click=async text=>{const h=await p.evaluateHandle(t=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim().replace(/\s*→$/,'')===t),text);assert.ok(h.asElement(),'Button not found: '+text);await h.asElement().click();await h.dispose()};
   const stored=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('compass-saved-plans')));
   await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.metrics');assert.doesNotMatch(await p.$eval('.bsum',e=>e.textContent),/Department Head/);
   await click('Edit plan');await p.waitForSelector('[aria-labelledby=g-audience]');assert.deepEqual(await labels(),expected);assert.match(await p.$eval('#audience-update',e=>e.textContent),/Choose at least one/);assert.equal(await p.$eval('.gen',e=>e.disabled),true);assert.deepEqual((await stored())[0],{...old,brief:{...old.brief,audiences:[]}});
   await click('Cancel');await p.waitForSelector('.bsum');assert.doesNotMatch(await p.$eval('.bsum',e=>e.textContent),/Department Head/);assert.deepEqual((await stored())[0],{...old,brief:{...old.brief,audiences:[]}});
   await click('Edit plan');await p.waitForSelector('[aria-labelledby=g-audience]');await p.locator('[aria-labelledby=g-audience] button').click();assert.equal(await p.$eval('.gen',e=>e.disabled),false);assert.deepEqual((await stored())[0],{...old,brief:{...old.brief,audiences:[]}});
   await p.locator('.gen').click();await p.waitForSelector('.planin',{timeout:20000});await click('Save changes');await p.waitForSelector('.bsum');assert.deepEqual((await stored())[0].brief.audiences,['Procurement']);
   await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.bsum');assert.match(await p.$eval('.bsum',e=>e.textContent),/Procurement/);assert.doesNotMatch(await p.$eval('.bsum',e=>e.textContent),/Department Head/);
   // Mixed old/current selections keep only the current selection in the draft.
   old.brief.audiences=['R&D','Scientist / Researcher'];await p.evaluate(plan=>localStorage.setItem('compass-saved-plans',JSON.stringify([plan])),old);await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.metrics');await click('Edit plan');await p.waitForSelector('[aria-labelledby=g-audience]');assert.equal(await p.$eval('[aria-labelledby=g-audience] button:nth-child(4)',e=>e.getAttribute('aria-pressed')),'true');assert.equal(await p.$eval('.gen',e=>e.disabled),false);assert.deepEqual((await stored())[0],{...old,brief:{...old.brief,audiences:['Scientist / Researcher']}});
   await ctx.close();
  }
 } finally {await browser?.close();server.kill()}
});
