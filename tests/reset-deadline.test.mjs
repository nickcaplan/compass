import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
test('reset deadline ends busy state, preserves conditional success and ignores a late response', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const local=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview')),10000);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
  const url=new URL(process.env.HOSTED_URL||local).href;
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of [390,1440]){
   const context=await browser.createBrowserContext(),p=await context.newPage();await p.setViewport({width,height:900});p.setDefaultTimeout(6000);
   // Keep the first test on the real 20-second deadline; speed up the second.
   if(width===1440)await p.evaluateOnNewDocument(()=>{const original=window.setTimeout;window.setTimeout=(fn,delay,...args)=>original(fn,delay===20000?200:delay,...args)});
   let held,hold=true,calls=0;const issued=[];await p.setRequestInterception(true);p.on('request',r=>{
    if(!r.url().includes('supabase.co'))return r.continue();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
    if(r.method()==='OPTIONS')return r.respond({status:204,headers});
    if(r.url().includes('/recover')){calls++;issued.push(new URL(r.url()).searchParams.get('redirect_to'));const respond=()=>r.respond({status:calls===2?429:200,headers,contentType:'application/json',body:calls===2?JSON.stringify({code:'over_email_send_rate_limit',msg:'You can request this after 60 seconds.'}):'{}'}).catch(()=>{});if(hold){held=respond;return}return respond()}
    return r.respond({status:200,headers,contentType:'application/json',body:'{}'});
   });
   await p.goto(url+'#/sign-in');await p.waitForSelector('#f-signin-email');await p.waitForSelector('.signin[aria-busy=false]');await p.locator('.email-forgot').click();await p.locator('#f-signin-email').fill('fixture@example.com');await p.locator('form .gen').click();await p.waitForFunction(()=>document.querySelector('form .gen')?.disabled);
   await p.waitForFunction(()=>document.querySelector('form [role=alert]')?.textContent.includes('took too long'),{timeout:25000});assert.equal(await p.$eval('form .gen',e=>e.disabled),false);assert.equal(calls,1);assert.match(await p.$eval('form [role=alert]',e=>e.textContent),/may still arrive/);if(process.env.RESET_SCREENSHOT_DIR){await mkdir(process.env.RESET_SCREENSHOT_DIR,{recursive:true});for(const theme of ['light','dark'])for(const scale of [100,200]){await p.evaluate(({theme,scale})=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize=scale+'%'},{theme,scale});await p.screenshot({path:`${process.env.RESET_SCREENSHOT_DIR}/reset-${width}-${theme}-${scale}.png`,fullPage:true})}}await held();
   assert.equal(await p.$('form [role=status]'),null,'A late response cannot claim delivery');hold=false;await p.locator('form .gen').click();await p.waitForSelector('form [role=status]');assert.match(await p.$eval('form [role=status]',e=>e.textContent),/If an account exists/);assert.equal(await p.$eval('form .gen',e=>e.disabled),false);assert.equal(calls,2);const retained=await p.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('compass-auth-v2');r.onsuccess=()=>resolve(r.result)});const state=await new Promise(resolve=>{const tx=db.transaction('state'),r=tx.objectStore('state').get('canonical');r.onsuccess=()=>resolve(r.result)});db.close();return state});assert.ok(retained.retainedCallbacks.includes(new URL(issued[0]).searchParams.get('compassAuth')),'Uncertain first delivery survives a retry');
   await context.close();
  }
 } finally {await browser?.close();server.kill()}
});
