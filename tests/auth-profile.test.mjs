import { installAuthFixture, fixtureNavigation } from './helpers/auth-fixtures.mjs';
import {stripVTControlCharacters} from 'node:util';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
const until=async(fn,label,ms=5000)=>{const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error(`Timed out waiting for ${label}`);await new Promise(r=>setTimeout(r,10));}};
const key='sb-ctailpmcoyvaplwbwskf-auth-token';
const user=(metadata={})=>({id:'test-profile',email:'profile@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:metadata,created_at:'2026-01-01T00:00:00Z'});
const session=u=>({access_token:'test',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'test-refresh',expires_in:3600,user:u});
test('profile completion, failure, persistence, and existing-plan gate', {timeout:60000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview ready')),10000);server.once('error',reject);server.once('exit',code=>reject(Error(`Preview exited ${code}`)));server.stdout.on('data',chunk=>{out+=chunk.toString();const match=stripVTControlCharacters(out).match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}})});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
  for(const width of [1440,390]){for(const theme of ['dark','light']){
   const ctx=await browser.createBrowserContext();const p=await ctx.newPage();p.setDefaultTimeout(6000);await p.setViewport({width,height:900});
   const click=label=>p.evaluate(l=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===l)?.click(),label);
   await p.evaluateOnNewDocument((theme)=>localStorage.setItem('compass-theme',theme),theme);
   let canonical={};let lookupFail=false;let lookupHold=false;let releaseLookup;let fail=true;let received;let hold=false;let release;let capturedAuthorization;
   await p.setRequestInterception(true);p.on('request',req=>{if(req.url().includes('/auth/v1/user')&&req.method()==='OPTIONS'){req.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'PUT,GET,OPTIONS','access-control-allow-headers':'*'}});}else if(req.url().includes('/auth/v1/user')&&req.method()==='GET'){const respond=()=>req.respond({status:lookupFail?500:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(lookupFail?{msg:'Lookup failed'}:user(canonical))});if(lookupHold){releaseLookup=respond;return;}respond();}else if(req.url().includes('/auth/v1/user')&&req.method()==='PUT'){received=JSON.parse(req.postData()).data;capturedAuthorization=req.headers().authorization;if(hold){release=()=>{canonical=received;return req.respond({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(user(received))});};return;}if(!fail)canonical=received;req.respond({status:fail?400:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(fail?{msg:'Test failure'}:user(received))});}else req.continue();});
   await (await installAuthFixture(p), fixtureNavigation(p,url+'?demo=1'));await p.waitForSelector('.themebtn');await click('Fill it in for me');await p.waitForFunction(()=>!document.querySelector('.gen').disabled);await p.locator('.gen').click();await p.waitForSelector('#f-gate-email');assert.match(await p.$eval('.planin .pagesub',e=>e.textContent),/Log in to see it/);assert.equal(await p.$('.metrics'),null);
   const brief=await p.evaluate(()=>({name:document.querySelector('#f-name').value,objectives:['awareness'],kpis:['Reach'],audiences:['Procurement'],seniority:['Manager'],budget:10000,start:'2026-12-01',end:'2027-02-01'}));
   await p.evaluate(brief=>localStorage.setItem('compass-saved-plans',JSON.stringify([{id:'existing',savedAt:'2026-11-01T12:00:00Z',brief}])),brief);
   await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('#f-gate-email');assert.match(await p.$eval('.planin .pagesub',e=>e.textContent),/Log in to see it/);assert.equal(await p.$('.metrics'),null,'Anonymous saved plan must be gated');assert.equal(await p.$('#f-name'),null,'Saved brief remains read-only while gated');
   // Seed only a test session, never contact a real user or provider.
   await p.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:session(user({...(width===1440?{full_name:'Google Name'}:{})}))});await p.reload();await p.waitForSelector('.themebtn');await p.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('profile@example.com'));assert.equal(await p.$eval('.signin .avatar',e=>e.textContent?.trim()),'P');assert.ok(!(await p.$eval('nav',e=>e.textContent)).includes('profile@example.com'),'Nav must not show the email');await p.locator('.signin').click();await p.waitForSelector('#f-signin-profile-name');assert.equal(await p.$eval('#f-signin-profile-name',e=>e.value),width===1440?'Google Name':'');assert.equal(await p.$eval('#f-signin-profile-company',e=>e.required),false);
   await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('#f-gate-profile-name');assert.equal(await p.$eval('.planin .pagesub',e=>e.textContent),'Add your details to see it. Your brief is kept.');assert.ok(await p.evaluate(()=>document.querySelector('.gate-secondary').getBoundingClientRect().top-document.querySelector('.planin form .gen').getBoundingClientRect().bottom)>=10,'Gate secondary has10px separation');assert.equal(await p.$('.metrics'),null);await p.locator('.signin').click();await p.waitForSelector('#f-signin-profile-name');

   await p.locator('#f-signin-profile-name').fill('   ');assert.equal(await p.$eval('form .gen',e=>e.disabled),true);
   await p.locator('#f-signin-profile-name').fill('Test Name');await p.locator('form .gen').click();await p.waitForSelector('[role=alert]');assert.equal(await p.$eval('#f-signin-profile-name',e=>e.value),'Test Name');
   const refreshed=session({...user({}),email:'refreshed-profile@example.com'});await p.evaluate(s=>{const c=new BroadcastChannel('sb-ctailpmcoyvaplwbwskf-auth-token');c.postMessage({event:'TOKEN_REFRESHED',session:s});setTimeout(()=>c.close(),100)},refreshed);await p.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('refreshed-profile@example.com'));assert.equal(await p.$eval('#f-signin-profile-name',e=>e.value),'Test Name');assert.ok(await p.$('[role=alert]'),'Refresh preserves profile-save failure');
   fail=false;await p.waitForFunction(()=>!document.querySelector('form .gen').disabled);await p.locator('form .gen').click();await p.waitForFunction(()=>!document.querySelector('form[aria-label="Complete your profile"]'));assert.equal(received.full_name,'Test Name');assert.equal(received.company,'');
   await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.metrics');await p.waitForSelector('.bsum');assert.equal(await p.$eval('.cap',e=>e.textContent),'SAVED PLAN - READ ONLY');assert.equal(await p.evaluate(()=>[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Save plan')),false);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.evaluate(brief=>localStorage.setItem('compass-auth-draft:account:test-profile',JSON.stringify({binding:{accountId:'test-profile'},brief,submittedBrief:brief,budgetText:'10000',stage:'filling',ts:Date.now()})),brief);
   await p.reload();await p.waitForSelector('.metrics');assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.secondary button')].find(e=>e.textContent.trim()==='Save plan')?.disabled),false,'Unchanged restored plan remains saveable');
   await p.evaluate(brief=>localStorage.setItem('compass-auth-draft:account:test-profile',JSON.stringify({binding:{accountId:'test-profile'},brief:{...brief,name:'Edited while link pending'},submittedBrief:brief,budgetText:'10000',stage:'filling',ts:Date.now()})),brief);
   await p.reload();await p.waitForFunction(()=>document.querySelector('#f-name')?.value==='Edited while link pending');assert.equal(await p.$('.metrics'),null,'Edited draft must not silently reveal stale output');
   canonical={};
   // Same-account refresh during save retains its new token and completes profile.
   await p.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:session(user({}))});await (await installAuthFixture(p), fixtureNavigation(p,url+'?demo=1#/sign-in'));await p.reload();await p.waitForSelector('#f-signin-profile-name');hold=true;release=null;await p.locator('#f-signin-profile-name').fill('Refreshed A profile');await p.locator('form .gen').click();await until(()=>release,'held profile PUT');await p.evaluate(async ({key,s})=>{(await window.fixtureAuth.setItem(key,JSON.stringify(s)));const c=new BroadcastChannel(key);c.postMessage({event:'TOKEN_REFRESHED',session:s});setTimeout(()=>c.close(),100)},{key,s:{...session(user({})),access_token:'refreshed-A-token'}});await new Promise(r=>setTimeout(r,50));release();await p.waitForSelector('form[aria-label="Complete your profile"]',{hidden:true});assert.equal(await p.evaluate(async k=>JSON.parse((await window.fixtureAuth.getItem(k))).access_token,key),'refreshed-A-token');await p.reload();await p.waitForFunction(()=>document.querySelector('.signincard h2')?.textContent==='Your account');hold=false;release=null;
   canonical={};
   // A late profile response cannot revive A after authenticated replacement B.
   await p.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:session(user({}))});await (await installAuthFixture(p), fixtureNavigation(p,url+'?demo=1#/sign-in'));await p.reload();await p.waitForSelector('#f-signin-profile-name');hold=true;await p.locator('#f-signin-profile-name').fill('Late A profile');await p.locator('form .gen').click();await until(()=>release,'held profile PUT');assert.equal(capturedAuthorization,'Bearer test');const replacement=session({...user({full_name:'B',compass_profile_complete:true}),id:'account-b',email:'b@example.com'});await p.evaluate(async ({key,s})=>{(await window.fixtureAuth.setItem(key,JSON.stringify(s)));const c=new BroadcastChannel(key);c.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>c.close(),100)},{key,s:replacement});await p.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('b@'));release();await new Promise(r=>setTimeout(r,100));assert.ok((await p.$eval('.signin',e=>e.getAttribute('aria-label'))).includes('b@'));assert.equal(await p.evaluate(async k=>JSON.parse((await window.fixtureAuth.getItem(k))).user.id,key),'account-b');
   // Independent tab replacement with no auth broadcast must not be overwritten.
   canonical={};hold=true;release=null;
   await p.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:session(user({}))});await p.reload();await p.waitForSelector('#f-signin-profile-name');
   await p.locator('#f-signin-profile-name').fill('Commit boundary A');await p.locator('form .gen').click();await until(()=>release,'held profile PUT');
   const other=await ctx.newPage();await other.setRequestInterception(true);other.on('request',req=>req.respond({status:200,contentType:'text/html',body:'<!doctype html><title>Storage-only independent tab</title>'}));await (await installAuthFixture(other), fixtureNavigation(other,url+'?demo=1'));
   await other.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:replacement});release();
   try { await p.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('Your session changed'),{polling:100}); }catch(error){console.error('Independent-tab state',await p.evaluate(async k=>({text:document.body.innerText,principal:JSON.parse((await window.fixtureAuth.getItem(k))??'null')?.user?.id,visibility:document.visibilityState}),key));throw error;}
   assert.equal(await p.evaluate(async k=>JSON.parse((await window.fixtureAuth.getItem(k))).user.id,key),'account-b');await other.close();
   // Canonical lookup failure cannot infer profile completion; delayed A read cannot replace B.
   hold=false;canonical={};lookupFail=true;
   await p.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:session(user({}))});await p.reload();await p.waitForSelector('#f-signin-profile-name');await new Promise(r=>setTimeout(r,100));assert.ok(await p.$('#f-signin-profile-name'));
   lookupFail=false;lookupHold=true;releaseLookup=null;await p.reload();await p.waitForSelector('#f-signin-profile-name');await until(()=>releaseLookup,'held canonical lookup');
   await p.evaluate(async ({key,s})=>{(await window.fixtureAuth.setItem(key,JSON.stringify(s)));const c=new BroadcastChannel(key);c.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>c.close(),100)},{key,s:replacement});await p.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('b@'));releaseLookup();await new Promise(r=>setTimeout(r,100));assert.ok((await p.$eval('.signin',e=>e.getAttribute('aria-label'))).includes('b@'));assert.equal(await p.evaluate(async k=>JSON.parse((await window.fixtureAuth.getItem(k))).user.id,key),'account-b');
   await ctx.close();
  }}
 }finally{await browser?.close();server.kill();}
});

test('signed-in account view shows account state, not log-in prompt', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview ready')),10000);server.once('error',reject);server.stdout.on('data',chunk=>{out+=chunk.toString();const match=stripVTControlCharacters(out).match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}})});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
  for(const width of [1440,390]){for(const theme of ['dark','light']){
   const ctx=await browser.createBrowserContext();const p=await ctx.newPage();p.setDefaultTimeout(6000);await p.setViewport({width,height:900});
   await p.evaluateOnNewDocument((theme)=>localStorage.setItem('compass-theme',theme),theme);
   const complete=session(user({full_name:'Test User',compass_profile_complete:true}));
   await (await installAuthFixture(p), fixtureNavigation(p,url+'?demo=1#/sign-in'));await p.waitForSelector('.themebtn');
   await p.evaluate(async ({key,s})=>(await window.fixtureAuth.setItem(key,JSON.stringify(s))),{key,s:complete});await p.reload();await p.waitForSelector('.signin');
   await p.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('profile@example.com'));
   assert.equal(await p.$eval('.signin .avatar',e=>e.textContent?.trim()),'P','Avatar shows the first letter');
   assert.ok(!(await p.$eval('nav',e=>e.textContent)).includes('profile@example.com'),'Nav must not show the email');
   assert.equal(await p.$eval('.signincard h2',e=>e.textContent),'Your account','Signed-in heading must not prompt to log in');
   assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.signincard .pagesub')].some(e=>e.textContent.includes('Save your plans'))),false,'Signed-in view drops the logged-out intro');
   assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.signincard .pagesub')].some(e=>e.textContent.includes('You are logged in as profile@example.com.'))),true);
   assert.ok(await p.evaluate(()=>[...document.querySelectorAll('.signincard button')].some(e=>e.textContent.trim()==='Log out')),'Log out button present');
   assert.equal(await p.evaluate(()=>document.querySelector('.signincard')?.getAttribute('aria-label')),'Account');
   assert.equal(await p.$('.signincard #f-signin-email'),null,'No log-in form while signed in');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await ctx.close();
  }}
 }finally{await browser?.close();server.kill();}
});
