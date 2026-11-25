import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {handleFixtureAuthRequest, seedPlannerFixture} from './planner-auth-fixture.mjs';
const chrome='/usr/bin/google-chrome';
const ecbSample={dataSets:[{series:{'0:0:0:0:0':{observations:{'0':[1.5707,0,0,null,null]}},'0:1:0:0:0':{observations:{'0':[0.837,0,0,null,null]}},'0:2:0:0:0':{observations:{'0':[1.1,0,0,null,null]}}}}],structure:{dimensions:{series:[{id:'FREQ',values:[{id:'D'}]},{id:'CURRENCY',values:[{id:'CAD'},{id:'GBP'},{id:'USD'}]}],observation:[{id:'TIME_PERIOD',values:[{id:'2026-11-25'}]}]}}};
async function fill(page,markets){
 await page.waitForSelector('#f-name');await page.locator('#f-name').fill('Currency campaign');
 for(const text of [...markets,'Consideration','Laboratory Manager']) await page.evaluate(text=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text).click(),text);
 await page.locator('#f-budget').fill('60000');
 await page.evaluate(()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [el,val] of [...document.querySelectorAll('input[type=date]')].map((e,i)=>[e,i?'2027-03-31':'2027-01-01'])){set.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}))}});
 await page.locator('button.gen').click();
 await page.waitForSelector('.sp-results');
}
test('live ECB rates are used when available and the dated snapshot when not',{timeout:120000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('Server timeout')),10000);s.stdout.on('data',d=>{out+=d;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(t);resolve(m[0]);}});});
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
  for(const mode of ['live','fail','slow-bad']){
   const context=await browser.createBrowserContext();const p=await context.newPage();p.setDefaultTimeout(20000);await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await p.setViewport({width:1440,height:900});await seedPlannerFixture(p,false);
   await p.setRequestInterception(true);let ecbCalls=0;
   p.on('request',r=>{if(handleFixtureAuthRequest(r))return;if(!r.url().includes('data-api.ecb.europa.eu'))return r.continue();ecbCalls++;const headers={'access-control-allow-origin':'*'};
    if(mode==='live')return r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(ecbSample)});
    if(mode==='fail')return r.abort();
    return r.respond({status:200,headers,contentType:'application/json',body:'{"unexpected":true}'})});
   await p.goto(url);await fill(p,['North America']);
   if(mode==='live')await p.waitForFunction(()=>/25 November 2026/.test(document.querySelector('.sp-results').textContent));
   else await new Promise(r=>setTimeout(r,800));
   const text=await p.$eval('.sp-results',e=>e.textContent);
   assert.match(text,/North America[\s\S]*· CAD/);assert.match(text,/Estimated cost · CAD/);
   if(mode==='live'){assert.match(text,/European Central Bank reference rates, 25 November 2026\./);assert.doesNotMatch(text,/unavailable/)}
   else{assert.match(text,/24 November 2026 \(live rates unavailable, using the saved rates from this date\)/)}
   assert.equal(ecbCalls,1,'one ECB request per page load');
   assert.ok(await p.$$eval('.sp-option',els=>els.length===0||els.every(e=>/CA\$[\d,]+/.test(e.textContent))),'costs show CAD');
   await context.close();
  }
 }finally{await browser?.close();s.kill()}
});
