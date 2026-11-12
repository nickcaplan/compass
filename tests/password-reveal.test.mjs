import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import {mkdir} from 'node:fs/promises';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import {seedSession} from './helpers/auth-fixtures.mjs';
test('in-field password reveal is keyboard accessible and resets between auth modes', {timeout:90000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview')),10000);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});if(process.env.SCREENSHOT_DIR)await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
  for(const width of [390,768,1440,1920])for(const theme of ['light','dark'])for(const enlarged of [false,true]){
   const context=await browser.createBrowserContext(),p=await context.newPage();p.setDefaultTimeout(6000);await p.setViewport({width,height:1000});await p.evaluateOnNewDocument(theme=>localStorage.setItem('compass-theme',theme),theme);await p.setRequestInterception(true);p.on('request',r=>r.url().includes('supabase.co')?r.respond({status:r.method()==='OPTIONS'?204:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:r.method()==='OPTIONS'?'':'{}'}):r.continue());await p.goto(url+'#/sign-in');await p.waitForSelector('.signin[aria-busy=false]');await p.waitForSelector('.password-reveal');
   for(const mode of ['signin','signup','update']){
    if(mode==='signup')await p.evaluate(()=>[...document.querySelectorAll('.email-modes button')].find(e=>e.textContent==='Create account').click());
    if(mode==='update'){
     const user={id:'reveal-fixture',email:'fixture@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{full_name:'Fixture Person',compass_profile_complete:true},created_at:'2026-01-01'};await seedSession(p,{access_token:'fixture',refresh_token:'fixture',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user},{notify:false});await p.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('compass-auth-v2');r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('canonical');r.onsuccess=()=>store.put({...r.result,recovery:{generation:r.result.generation,userId:'reveal-fixture'}},'canonical');tx.oncomplete=resolve});db.close();const c=new BroadcastChannel('compass-auth-v2');c.postMessage({});c.close()});await p.waitForSelector('.cancel-recovery');
    }
    assert.equal(await p.$eval('.password-control input',e=>e.type),'password','Mode starts concealed');await p.locator('.password-control input').fill('Example-password-123');assert.equal(await p.$eval('.password-control input',e=>e.autocomplete),mode==='signin'?'current-password':'new-password');
    await p.focus('.password-reveal');await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('.password-control input')?.type==='text');assert.equal(await p.$eval('.password-reveal',e=>e.getAttribute('aria-pressed')),'true');assert.equal(await p.$eval('.password-reveal',e=>e.getAttribute('aria-label')),'Hide password');assert.equal(await p.$eval('.password-control input',e=>e.value),'Example-password-123');assert.equal(await p.evaluate(()=>document.activeElement.classList.contains('password-reveal')),true,'Keyboard focus stays on toggle');
    if(enlarged)await p.evaluate(()=>{for(const e of document.querySelectorAll('.signincard *'))if(!e.dataset.enlarged){e.dataset.enlarged='true';e.dataset.baseFont=getComputedStyle(e).fontSize}for(const e of document.querySelectorAll('[data-base-font]'))e.style.fontSize=parseFloat(e.dataset.baseFont)*2+'px'});
    const metrics=await p.$eval('.password-reveal',e=>{const b=e.getBoundingClientRect(),i=e.parentElement.querySelector('input').getBoundingClientRect();return {w:b.width,h:b.height,left:b.left,right:b.right,il:i.left,ir:i.right,top:b.top,bottom:b.bottom,it:i.top,ib:i.bottom,pad:parseFloat(getComputedStyle(e.parentElement.querySelector('input')).paddingRight)}});assert.ok(metrics.w>=44&&metrics.h>=44,JSON.stringify(metrics));assert.ok(metrics.left>=metrics.il&&metrics.right<=metrics.ir,JSON.stringify(metrics));assert.ok(metrics.pad>=metrics.w,JSON.stringify(metrics));assert.ok(metrics.top>=metrics.it&&metrics.bottom<=metrics.ib,JSON.stringify(metrics));
    if(process.env.SCREENSHOT_DIR)await p.screenshot({path:`${process.env.SCREENSHOT_DIR}/password-${mode}-${width}-${theme}-${enlarged?200:100}.png`,fullPage:true});await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.password-control input')?.type==='password');assert.equal(await p.$eval('.password-control input',e=>e.value),'Example-password-123');
    // Leave it visible so changing mode must conceal it.
    await p.keyboard.press('Space');
   }
   await context.close();
  }
 }finally{await browser?.close();server.kill()}
});
