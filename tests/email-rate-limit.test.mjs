import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
test('email rate limits get distinct inline messages without an invented countdown', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview ready')),10000);server.once('error',reject);server.once('exit',code=>reject(Error(`Preview exited ${code}`)));server.stdout.on('data',chunk=>{out+=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');const match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}})});
  browser=await puppeteer.launch({executablePath:process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const context=await browser.createBrowserContext();const p=await context.newPage();p.setDefaultTimeout(8000);await p.setViewport({width:390,height:844});
  // nextError: the error payload the next auth call should fail with.
  let nextError=null; let requestCount=0; let delayMs=0;
  await p.setRequestInterception(true);p.on('request',req=>{
   if(!req.url().includes('ctailpmcoyvaplwbwskf.supabase.co'))return req.continue();
   const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'*'};
   if(req.method()==='OPTIONS')return req.respond({status:204,headers});
   let status=200,body={};
   const isAuth=/\/(recover|signup|token)(\?|$)/.test(req.url()); if(isAuth) requestCount++;
   if((req.url().includes('/recover')||req.url().includes('/signup')||req.url().includes('/token'))&&nextError){
    status=429;body=nextError;nextError=null;
   }
   const respond=()=>req.respond({status,headers,contentType:'application/json',body:JSON.stringify(body)});
   if(isAuth&&delayMs) return setTimeout(respond,delayMs);
   return respond();
  });
  await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');await p.locator('#f-name').fill('Rate limit draft');await p.locator('.signin').click();await p.waitForSelector('#f-signin-email');
  const draftName='Rate limit draft';
  const submit=()=>p.locator('form[aria-label="Email account"] .gen').click();
  // Wait until the alert shows the NEW message (a previous error can still be on screen at click time).
  const alertText=async(re)=>{await p.waitForFunction(src=>{const e=document.querySelector('form [role=alert]');return e&&new RegExp(src).test(e.textContent)},{},re.source);return p.$eval('form [role=alert]',e=>e.textContent)};
  // 1. Project-wide email quota on reset: named as our limit, no invented countdown, email kept.
  await p.locator('.email-forgot').click();await p.locator('#f-signin-email').fill('quota@example.com');
  nextError={error_code:'over_email_send_rate_limit',code:'over_email_send_rate_limit',msg:'email rate limit exceeded'};await submit();
  let msg=await alertText(/email limit/i);assert.match(msg,/email limit/i);assert.doesNotMatch(msg,/\d+ seconds/);assert.equal(await p.$eval('#f-signin-email',e=>e.value),'quota@example.com');
  // 2. Per-recipient cooldown: never pins server seconds that would go stale on screen.
  nextError={error_code:'over_email_send_rate_limit',code:'over_email_send_rate_limit',msg:'For security purposes, you can only request this after 37 seconds.'};await submit();
  msg=await alertText(/wait a short while/);assert.match(msg,/wait a short while/);assert.doesNotMatch(msg,/\d+ seconds/);assert.equal(await p.$eval('#f-signin-email',e=>e.value),'quota@example.com');
  // 3. IP throttle on signup: distinct network message.
  await p.evaluate(()=>[...document.querySelectorAll('.email-modes button')].find(e=>e.textContent==='Create account').click());
  await p.locator('#f-signin-email').fill('throttle@example.com');await p.locator('#f-signin-password').fill('example-test-only');
  nextError={error_code:'over_request_rate_limit',code:'over_request_rate_limit',msg:'Request rate limit reached'};await submit();
  msg=await alertText(/Too many attempts from this network/);assert.match(msg,/Too many attempts from this network/);assert.doesNotMatch(msg,/\d+ (seconds|minutes)/);assert.equal(await p.$eval('#f-signin-email',e=>e.value),'throttle@example.com');
  // Draft and password survive all three failures. No real provider requests are used.
  assert.equal(await p.$eval('#f-signin-password',e=>e.value),'example-test-only');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('compass-auth-draft:email:quota@example.com')).brief.name),draftName);
  // Returning to reset clears the error, preserves email, and allows a retry.
  await p.evaluate(()=>document.querySelector('.email-modes button').click());
  assert.equal(await p.$('form [role=alert]'),null);
  await p.locator('.email-forgot').click();
  const countBefore=requestCount;delayMs=500;
  await submit();
  await p.waitForFunction(()=>document.querySelector('form .gen').disabled);
  assert.equal(await p.$eval('#f-signin-email',e=>e.disabled),true);
  // A second submit while the response is pending must not start another call.
  await p.evaluate(()=>document.querySelector('form[aria-label="Email account"]').requestSubmit());
  await p.waitForSelector('form [role=status]');
  assert.equal(requestCount,countBefore+1);assert.equal(await p.$('form [role=alert]'),null);
  assert.equal(await p.$eval('#f-signin-email',e=>e.value),'throttle@example.com');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('compass-auth-draft:email:quota@example.com')).brief.name),draftName);
  await context.close();
 }finally{await browser?.close();server.kill()}
 // 4. Ordinary failures keep their existing copy (plain 400 on reset).
 const server2=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser2;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview ready')),10000);server2.once('error',reject);server2.once('exit',code=>reject(Error(`Preview exited ${code}`)));server2.stdout.on('data',chunk=>{out+=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');const match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}})});
  browser2=await puppeteer.launch({executablePath:process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const p=await browser2.newPage();p.setDefaultTimeout(8000);await p.setViewport({width:390,height:844});
  await p.setRequestInterception(true);p.on('request',req=>{
   if(!req.url().includes('ctailpmcoyvaplwbwskf.supabase.co'))return req.continue();
   const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'*'};
   if(req.method()==='OPTIONS')return req.respond({status:204,headers});
   if(req.url().includes('/recover'))return req.respond({status:400,headers,contentType:'application/json',body:JSON.stringify({msg:'Invalid email address'})});
   return req.respond({status:200,headers,contentType:'application/json',body:'{}'});
  });
  await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');await p.locator('.signin').click();await p.waitForSelector('#f-signin-email');
  await p.locator('.email-forgot').click();await p.locator('#f-signin-email').fill('plain@example.com');await p.locator('form[aria-label="Email account"] .gen').click();
  await p.waitForSelector('form [role=alert]');assert.match(await p.$eval('form [role=alert]',e=>e.textContent),/Could not request a reset email/);
 }finally{await browser2?.close();server2.kill()}
});
