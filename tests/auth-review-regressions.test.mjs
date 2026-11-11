import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import {seedSession} from './helpers/auth-fixtures.mjs';
const user={id:'existing-b',email:'b@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'google'},user_metadata:{full_name:'B',compass_profile_complete:true},created_at:'2026-01-01'};
const session={access_token:'fixture-b',refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const brief={name:'Private flow A',objectives:['awareness'],markets:['uk'],kpis:['Reach'],audiences:['Scientist / Researcher'],budget:10000,start:'2026-12-01',end:'2027-02-01'};
test('OAuth persistence failures keep visible work; rejected callbacks cannot bind another flow; signed-out saved routes survive hydration',{timeout:60000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 for(const width of [390,1440]){
 for(const storage of ['localStorage','sessionStorage']){
 const context=await browser.createBrowserContext(),p=await context.newPage();p.setDefaultTimeout(6000);await p.setViewport({width,height:900});let providerRequests=0;
 await p.setRequestInterception(true);p.on('request',async r=>{if(r.url().includes('supabase.co')){providerRequests++;return r.abort()}if(r.url().includes('/assets/')&&r.url().endsWith('.js')){const response=await fetch(r.url());const body=(await response.text()).replace(/[\w$]+\.auth\.signInWithOAuth/g,'({signInWithOAuth:async()=>{window.oauthStarts=(window.oauthStarts??0)+1;return {error:null}}}).signInWithOAuth');return r.respond({status:200,contentType:'application/javascript',body})}return r.continue()});
 await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');await p.locator('#f-name').fill('Only live copy');await p.locator('.signin').click();await p.waitForSelector('.sso');
 await p.evaluate(storage=>{const target=window[storage],original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===target)throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,k,v)}},storage);
 await p.locator('.sso').click();await p.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('Could not keep your brief'));assert.equal(await p.evaluate(()=>window.oauthStarts??0),0);assert.equal(providerRequests,0);await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Planner').click());await p.waitForSelector('#f-name');assert.equal(await p.$eval('#f-name',e=>e.value),'Only live copy');await context.close();
 }
 const context=await browser.createBrowserContext(),p=await context.newPage();p.setDefaultTimeout(6000);await p.setViewport({width,height:900});let providerRequests=0;
 await p.setRequestInterception(true);p.on('request',r=>{if(!r.url().includes('supabase.co'))return r.continue();providerRequests++;return r.respond({status:r.method()==='OPTIONS'?204:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'},contentType:'application/json',body:r.method()==='OPTIONS'?'':JSON.stringify(user)})});
 await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');
 await seedSession(p,session,{callback:'newer-b-request',notify:false});await p.evaluate(brief=>{sessionStorage.setItem('compass-auth-flow','old-a-flow');localStorage.setItem('compass-auth-draft:google:old-a-flow',JSON.stringify({brief,submittedBrief:null,budgetText:'10000',stage:'filling',binding:{googleFlow:'old-a-flow'},ts:Date.now()}))},brief);
 // Deliberately bypass fixtureNavigation: it would authenticate this stale link.
 await p.goto(url+'?demo=1&compassAuth=stale-a-request#provider_token=fixture&access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIiwiZXhwIjo0MDAwMDAwMDAwfQ.fake&refresh_token=fixture');
 await p.waitForSelector('.avatar');await p.waitForFunction(()=>!location.hash.includes('access_token='));assert.equal(await p.$eval('#f-name',e=>e.value),'');assert.ok(await p.evaluate(()=>localStorage.getItem('compass-auth-draft:google:old-a-flow')));assert.equal(await p.evaluate(()=>localStorage.getItem('compass-auth-draft:account:existing-b')),null);
 await seedSession(p,null,{notify:false});await p.evaluate(brief=>{localStorage.setItem('compass-saved-plans',JSON.stringify([{id:'signed-out-saved',brief,savedAt:new Date().toISOString()}]));sessionStorage.removeItem('compass-auth-flow')},brief);
 await p.goto(url+'#/planner/signed-out-saved');await p.waitForSelector('#f-gate-email');await p.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-busy')==='false');await new Promise(r=>setTimeout(r,100));assert.equal(await p.evaluate(()=>Boolean(document.querySelector('section[aria-label="Saved plan brief"]'))),true,'Initial null session must retain saved selection');
 // A controller startup failure must be visible in the gate, not only Sign in.
 await p.evaluateOnNewDocument(()=>{const original=indexedDB.open.bind(indexedDB);indexedDB.open=(...args)=>{if(args[0]==='compass-auth-v2')throw Error('fixture unavailable');return original(...args)}});await p.reload();await p.waitForSelector('.planin > [role=alert]');assert.match(await p.$eval('.planin > [role=alert]',e=>e.textContent),/Secure browser storage/);
 await new Promise(r=>setTimeout(r,600));if(process.env.SCREENSHOT_DIR)await p.screenshot({path:process.env.SCREENSHOT_DIR+'/gate-error-'+width+'.png',fullPage:true});
 await context.close();
 }
 }finally{await browser?.close();server.kill()}
});
