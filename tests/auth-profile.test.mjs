import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
const key='sb-ctailpmcoyvaplwbwskf-auth-token';
const user=(metadata={})=>({id:'test-profile',email:'profile@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:metadata,created_at:'2026-01-01T00:00:00Z'});
const session=u=>({access_token:'test',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'test-refresh',expires_in:3600,user:u});
test('profile completion, failure, persistence, and existing-plan gate', {timeout:60000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview ready')),10000);server.once('error',reject);server.once('exit',code=>reject(Error(`Preview exited ${code}`)));server.stdout.on('data',chunk=>{out+=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');const match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}})});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
  for(const width of [1440,390]){for(const theme of ['dark','light']){
   const ctx=await browser.createBrowserContext();const p=await ctx.newPage();p.setDefaultTimeout(6000);await p.setViewport({width,height:900});
   const click=label=>p.evaluate(l=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===l)?.click(),label);
   await p.evaluateOnNewDocument((theme)=>localStorage.setItem('compass-theme',theme),theme);
   await p.goto(url+'?demo=1');await p.waitForSelector('.themebtn');await click('Fill it in for me');await p.waitForFunction(()=>!document.querySelector('.gen').disabled);await p.locator('.gen').click();await p.waitForSelector('#f-gate-email');assert.equal(await p.$('.metrics'),null);
   const brief=await p.evaluate(()=>({name:document.querySelector('#f-name').value,objectives:['awareness'],kpis:['Reach'],audiences:['Procurement'],seniority:['Manager'],budget:10000,start:'2026-12-01',end:'2027-02-01'}));
   await p.evaluate(brief=>localStorage.setItem('compass-saved-plans',JSON.stringify([{id:'existing',savedAt:'2026-11-01T12:00:00Z',brief}])),brief);
   await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('#f-gate-email');assert.equal(await p.$('.metrics'),null,'Anonymous saved plan must be gated');assert.equal(await p.$('#f-name'),null,'Saved brief remains read-only while gated');
   // Seed only a test session, never contact a real user or provider.
   await p.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:session(user({...(width===1440?{full_name:'Google Name'}:{})}))});await p.reload();await p.waitForSelector('.themebtn');await p.waitForFunction(()=>document.querySelector('.signin')?.textContent.trim()==='profile@example.com');await p.locator('.signin').click();await p.waitForSelector('#f-signin-profile-name');assert.equal(await p.$eval('#f-signin-profile-name',e=>e.value),width===1440?'Google Name':'');assert.equal(await p.$eval('#f-signin-profile-company',e=>e.required),false);
   await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('#f-gate-profile-name');assert.equal(await p.$('.metrics'),null);await p.locator('.signin').click();await p.waitForSelector('#f-signin-profile-name');

   let fail=true;let received;
   await p.setRequestInterception(true);p.on('request',req=>{if(req.url().includes('/auth/v1/user')&&req.method()==='OPTIONS'){req.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'PUT,GET,OPTIONS','access-control-allow-headers':'*'}});}else if(req.url().includes('/auth/v1/user')&&req.method()==='PUT'){received=JSON.parse(req.postData()).data;req.respond({status:fail?400:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(fail?{msg:'Test failure'}:user(received))});}else req.continue();});
   await p.locator('#f-signin-profile-name').fill('   ');assert.equal(await p.$eval('form .gen',e=>e.disabled),true);
   await p.locator('#f-signin-profile-name').fill('Test Name');await p.locator('form .gen').click();await p.waitForSelector('[role=alert]');assert.equal(await p.$eval('#f-signin-profile-name',e=>e.value),'Test Name');
   const refreshed=session({...user({}),email:'refreshed-profile@example.com'});await p.evaluate(s=>{const c=new BroadcastChannel('sb-ctailpmcoyvaplwbwskf-auth-token');c.postMessage({event:'TOKEN_REFRESHED',session:s});setTimeout(()=>c.close(),100)},refreshed);await p.waitForFunction(()=>document.querySelector('.signin')?.textContent.includes('refreshed-profile@example.com'));assert.equal(await p.$eval('#f-signin-profile-name',e=>e.value),'Test Name');assert.ok(await p.$('[role=alert]'),'Refresh preserves profile-save failure');
   fail=false;await p.waitForFunction(()=>!document.querySelector('form .gen').disabled);await p.locator('form .gen').click();await p.waitForFunction(()=>!document.querySelector('form[aria-label="Complete your profile"]'));assert.equal(received.full_name,'Test Name');assert.equal(received.company,'');
   await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.metrics');await p.waitForSelector('.bsum');assert.equal(await p.$eval('.cap',e=>e.textContent),'SAVED PLAN - READ ONLY');assert.equal(await p.evaluate(()=>[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Save plan')),false);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.evaluate(brief=>localStorage.setItem('compass-auth-draft',JSON.stringify({brief,submittedBrief:brief,budgetText:'10000',stage:'filling',ts:Date.now()})),brief);
   await p.reload();await p.waitForSelector('.metrics');assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.secondary button')].find(e=>e.textContent.trim()==='Save plan')?.disabled),false,'Unchanged restored plan remains saveable');
   await p.evaluate(brief=>localStorage.setItem('compass-auth-draft',JSON.stringify({brief:{...brief,name:'Edited while link pending'},submittedBrief:brief,budgetText:'10000',stage:'filling',ts:Date.now()})),brief);
   await p.reload();await p.waitForFunction(()=>document.querySelector('#f-name')?.value==='Edited while link pending');assert.equal(await p.$('.metrics'),null,'Edited draft must not silently reveal stale output');
   await ctx.close();
  }}
 }finally{await browser?.close();server.kill();}
});
