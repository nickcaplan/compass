import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {seedPlannerFixture} from './planner-auth-fixture.mjs';
const chrome='/usr/bin/google-chrome';
async function fill(page, objective='Consideration', markets=['UK']) {
 await page.waitForSelector('#f-name');
 await page.locator('#f-name').fill('Laboratory manager campaign');
 for(const text of [...markets,objective,'Laboratory Manager']) await page.evaluate(text=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text).click(),text);
 await page.locator('#f-budget').fill('60000');
 await page.evaluate(()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [el,val] of [...document.querySelectorAll('input[type=date]')].map((e,i)=>[e,i?'2027-03-31':'2027-01-01'])){set.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});
 await page.locator('button.gen').click();
}
test('connected source slice respects brief, units, gate, no save and legacy isolation',{timeout:180000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
 const url=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('Server timeout')),10000);s.stdout.on('data',d=>{out+=d;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(t);resolve(m[0]);}});});
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
 const p=await browser.newPage();await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await seedPlannerFixture(p);
 await p.goto(url+'?source-options=1');await fill(p);await p.waitForSelector('.sp-option');
 assert.match(await p.$eval('.sp-results',e=>e.textContent),/Audience matching is pending/);
 assert.equal(await p.$('.planin .metrics'),null);assert.equal(await p.$('.planin .timing'),null);
 assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.planin button')].some(e=>/^Save/.test(e.textContent.trim()))),false);
 assert.equal(await p.$$eval('.sp-option',els=>els.length),23);
 const text=await p.$eval('.sp-results',e=>e.textContent);assert.match(text,/No GBP conversion/);assert.doesNotMatch(text,/Publisher [ABC]/);
 const before=await p.evaluate(()=>localStorage.getItem('compass-plans'));await p.reload();await p.waitForSelector('#f-name');assert.equal(await p.evaluate(()=>localStorage.getItem('compass-plans')),before);
 for(const [objective,markets,count] of [['Performance',['UK'],0],['Consideration',['UK','France'],46]]){await p.goto(url+'?source-options=1');await fill(p,objective,markets);await p.waitForSelector('.sp-results');assert.equal(await p.$$eval('.sp-option',e=>e.length),count);if(!count)assert.match(await p.$eval('.sp-results',e=>e.textContent),/No source options ready/);}
 await p.goto(url+'?source-options=1');await fill(p);await p.waitForSelector('.sp-option');await p.locator('.sp-option summary').click();assert.equal(await p.$eval('.sp-option details',e=>e.open),true);await p.locator('.sp-option summary').click();assert.equal(await p.$eval('.sp-option details',e=>e.open),false);
 const dir=process.env.SOURCE_SCREENSHOT_DIR;
 if(dir){await mkdir(dir,{recursive:true});for(const [mode,q] of [['before',''],['after','?source-options=1']]){await p.goto(url+q);await fill(p);await p.waitForSelector(mode==='after'?'.sp-option':'.act');for(const width of [320,390,768,1440])for(const theme of ['dark','light'])for(const scale of [100,200]){await p.setViewport({width,height:960});await p.evaluate(({theme,scale})=>{document.documentElement.dataset.theme=theme;for(const el of document.querySelectorAll('.sp-results *')){if(el.dataset.originalStyle!==undefined){el.setAttribute('style',el.dataset.originalStyle);delete el.dataset.originalStyle;}}if(scale===200){const sizes=[...document.querySelectorAll('.sp-results *')].map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);for(const [el,size] of sizes){el.dataset.originalStyle=el.getAttribute('style')||'';el.style.fontSize=(size*2)+'px';}}},{theme,scale});await p.evaluate(()=>document.querySelector('.planhead').scrollIntoView());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${mode}/${width}/${theme}/${scale}`);if((width===390||width===1440)&&scale===100&&theme==='dark')await p.screenshot({path:`${dir}/${mode}-${width}.png`});if(mode==='after'&&width===320&&theme==='light'&&scale===200)await p.screenshot({path:`${dir}/after-320-light-200.png`});} }}
 const anonymousContext=await browser.createBrowserContext();const anon=await anonymousContext.newPage();await anon.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await anon.setRequestInterception(true);anon.on('request',r=>r.url().includes('supabase.co')?r.abort():r.continue());await anon.goto(url+'?source-options=1');await fill(anon);await anon.waitForSelector('#f-gate-email');assert.equal(await anon.$('.sp-results'),null,'source results retain auth gate');
 } finally {await browser?.close();s.kill();}
});
