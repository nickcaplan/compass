import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import { seedSession, readSession } from './helpers/auth-fixtures.mjs';
const user = id => ({ id, email: `${id}@example.com`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { full_name: id, compass_profile_complete: true }, created_at: '2026-01-01' });
const session = id => ({ access_token: 'fixture-' + id, refresh_token: 'fixture-refresh-' + id, expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: user(id) });
const until = async (fn, label) => { const end = Date.now()+5000; while (!fn()) { if(Date.now()>end) throw Error('Timed out: '+label); await new Promise(r=>setTimeout(r,10)); } };

test('canonical controller rejects delayed login after replacement or logout, across two tabs and reload', { timeout: 60000 }, async () => {
 const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'], {stdio:['ignore','pipe','pipe']}); let browser;
 try {
  const url = await new Promise((resolve,reject) => { let output=''; const timer=setTimeout(()=>reject(Error('Preview unavailable')),10000); server.once('error',reject); server.stdout.on('data',b=>{output+=stripVTControlCharacters(b.toString());const m=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}}); });
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of [390,1440]) {
   const context=await browser.createBrowserContext();const a=await context.newPage(),b=await context.newPage();let release,held=false;const errors=[];
   for(const page of [a,b]) { page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height:900});await page.setRequestInterception(true);page.on('request',request=>{
    if(!request.url().includes('supabase.co'))return request.continue();
    const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,PUT,OPTIONS','access-control-allow-headers':'*'};
    if(request.method()==='OPTIONS')return request.respond({status:204,headers});
    const reply=()=>request.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(request.url().includes('/user')?user('b'):request.url().includes('/logout')?{}:session('a'))});
    if(request.url().includes('/token')&&page===a) {held=true;release=reply;return;}return reply();
   });await page.goto(url+'?demo=1');await page.waitForSelector('#f-name'); }
   const plans=await a.evaluate(()=>localStorage.getItem('compass-saved-plans'));
   for(const replacement of [session('b'),null]) {
    await a.bringToFront();
    await seedSession(a,null);await a.reload();await a.waitForSelector('.signin');await a.locator('.signin').click();await a.waitForSelector('#f-signin-email');await a.locator('#f-signin-email').fill('a@example.com');await a.locator('#f-signin-password').fill('fixture-only-password');held=false;await a.locator('form[aria-label="Email account"] .gen').click();await until(()=>held,'held login A');
    await seedSession(b,replacement);release();await new Promise(r=>setTimeout(r,200));
    assert.equal((await readSession(a))?.user.id,replacement?.user.id);assert.equal((await readSession(b))?.user.id,replacement?.user.id);
    await a.reload();await a.waitForSelector('.signin');if(replacement)await a.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('b@example.com'));else await a.waitForFunction(()=>!document.querySelector('.avatar'));
   }
   assert.equal(await a.evaluate(()=>localStorage.getItem('compass-saved-plans')),plans,'Auth transitions never rewrite saved plans');
   // Old SDK token and broadcast channel cannot resurrect legacy account A.
   await a.evaluate(s=>{localStorage.setItem('sb-ctailpmcoyvaplwbwskf-auth-token',JSON.stringify(s));const c=new BroadcastChannel('sb-ctailpmcoyvaplwbwskf-auth-token');c.postMessage({event:'SIGNED_IN',session:s});c.close();},session('a'));
   await a.reload();await a.waitForSelector('.signin');assert.equal(await readSession(a),null);assert.equal(await a.$('.avatar'),null);assert.deepEqual(errors,[]);await context.close();
  }
 } finally { await browser?.close();server.kill(); }
});

test('unbound callbacks and unavailable secure storage cannot authenticate or mutate an account', { timeout: 30000 }, async () => {
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const context=await browser.createBrowserContext();const page=await context.newPage();page.setDefaultTimeout(5000);const providerAuthorizations=[];
  await page.setRequestInterception(true);page.on('request',r=>{if(r.url().includes('supabase.co')){providerAuthorizations.push(r.headers().authorization);return r.abort();}return r.continue();});
  await page.goto(url+'?demo=1');await page.waitForSelector('#f-name');await seedSession(page,session('b'));await page.goto(url+'?demo=1&compassAuth=not-issued#access_token=fixture-a&refresh_token=fixture&expires_in=3600&token_type=bearer&type=recovery');await page.waitForSelector('.signin');await page.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('b@example.com'));assert.equal((await readSession(page)).user.id,'b');await page.locator('.signin').click();await page.waitForSelector('.signincard');assert.equal(await page.$('.cancel-recovery'),null);assert.equal(await page.$('input[type=password]'),null);assert.ok(!providerAuthorizations.includes('Bearer fixture-a'),'Unbound callback never sends its token to provider');
  await context.close();
  const blocked=await browser.createBrowserContext();const p=await blocked.newPage();await p.setViewport({width:390,height:900});p.setDefaultTimeout(5000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.evaluateOnNewDocument(()=>Object.defineProperty(window,'indexedDB',{value:undefined}));await p.goto(url+'?demo=1#/sign-in');await p.waitForSelector('.pagecard > [role=alert]');assert.match(await p.$eval('.pagecard > [role=alert]',e=>e.textContent),/Secure browser storage is unavailable/);assert.equal(await p.$('.avatar'),null);assert.deepEqual(errors,[]);if(process.env.SCREENSHOT_DIR)await p.screenshot({path:process.env.SCREENSHOT_DIR+'/controller-storage-failure-390.png',fullPage:true});await blocked.close();
 } finally {await browser?.close();server.kill();}
});

test('a delayed recovery callback cannot give replacement B recovery privileges', { timeout: 30000 }, async () => {
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const context=await browser.createBrowserContext(),a=await context.newPage(),b=await context.newPage();let release;const errors=[];
  for(const p of [a,b]){p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(!r.url().includes('supabase.co'))return r.continue();const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};if(r.method()==='OPTIONS')return r.respond({status:204,headers});if(p===a&&r.url().includes('/user')){release=()=>r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(user('a'))});return;}return r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(user('b'))});});await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');}
  await seedSession(a,null,{callback:'issued-a',notify:false});await a.goto(url+'?demo=1&compassAuth=issued-a#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIiwiZXhwIjo0MDAwMDAwMDAwfQ.fake&refresh_token=fixture&expires_in=3600&token_type=bearer&type=recovery');await until(()=>release,'held recovery lookup');await seedSession(b,session('b'));release();await a.bringToFront();await a.waitForFunction(()=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes('b@example.com'),{polling:100});assert.equal((await readSession(a)).user.id,'b');await a.bringToFront();await a.locator('.signin').click();await a.waitForSelector('.signincard');assert.equal(await a.$('.cancel-recovery'),null);assert.equal(await a.$('input[type=password]'),null);assert.deepEqual(errors,[]);await context.close();
 }finally{await browser?.close();server.kill();}
});

test('runtime transaction failure stays blocked inline and failed callbacks remove URL tokens', { timeout: 30000 }, async () => {
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const ctx=await browser.createBrowserContext(),p=await ctx.newPage();p.setDefaultTimeout(6000);await p.setViewport({width:390,height:900});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.setRequestInterception(true);p.on('request',r=>r.url().includes('supabase.co')?r.abort():r.continue());
  await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');await seedSession(p,session('b'));await p.waitForSelector('.avatar');
  await p.evaluate(()=>{const original=IDBDatabase.prototype.transaction;window.restoreFixtureTransactions=()=>{IDBDatabase.prototype.transaction=original;};IDBDatabase.prototype.transaction=function(...args){if(this.name==='compass-auth-v2')throw new Error('fixture runtime transaction failure');return original.apply(this,args);};for(let i=0;i<10;i++)setTimeout(()=>window.dispatchEvent(new Event('focus')),i*10);});
  await p.waitForFunction(()=>!document.querySelector('.avatar'));await p.locator('.signin').click();await p.waitForFunction(()=>document.body.textContent.includes('Secure browser storage is unavailable'));assert.equal(await p.$('.avatar'),null);await p.evaluate(()=>{window.restoreFixtureTransactions();window.dispatchEvent(new Event('focus'));});await new Promise(r=>setTimeout(r,100));assert.equal(await p.$('.avatar'),null,'A failed controller cannot resume publication before reload');await p.reload();await p.waitForSelector('.avatar');
  await seedSession(p,null,{callback:'failed-issued',notify:false});await p.goto(url+'?demo=1&compassAuth=failed-issued#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIiwiZXhwIjo0MDAwMDAwMDAwfQ.fake&refresh_token=fixture&type=recovery');
  await p.waitForFunction(()=>!location.hash&&!new URL(location.href).searchParams.has('compassAuth'));await p.waitForSelector('.signin');await p.locator('.signin').click();await p.waitForSelector('.signincard');assert.equal(await p.$('.cancel-recovery'),null);assert.equal(await readSession(p),null);assert.deepEqual(errors,[]);await ctx.close();
 }finally{await browser?.close();server.kill();}
});

test('same-generation concurrent refresh retains the winning rotation after a delayed success or rejection', { timeout: 30000 }, async () => {
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const loserStatus of [200,400]) {
   const ctx=await browser.createBrowserContext(),a=await ctx.newPage(),b=await ctx.newPage();const pending=[],errors=[];
   for(const p of[a,b]){p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(!r.url().includes('supabase.co'))return r.continue();const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};if(r.method()==='OPTIONS')return r.respond({status:204,headers});if(r.url().includes('/token')){pending.push((status,body)=>r.respond({status,headers,contentType:'application/json',body:JSON.stringify(body)}));return;}return r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(user('a'))});});await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');}
   // Seed without live app controllers: focus/pageshow on the old documents
   // could start refreshes that reload then aborts, polluting the pending pair.
   await Promise.all([a.goto(url+'favicon.svg'),b.goto(url+'favicon.svg')]);
   await seedSession(a,{...session('a'),expires_at:Math.floor(Date.now()/1000)-10},{notify:false});await Promise.all([a.goto(url+'?demo=1'),b.goto(url+'?demo=1')]);await until(()=>pending.length===2,'two concurrent SDK refreshes');
   const winner={...session('a'),access_token:'rotated-winner',refresh_token:'rotated-winner-refresh'};await pending[0](200,winner);await a.waitForFunction(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('compass-auth-v2');r.onsuccess=()=>resolve(r.result);});const result=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('canonical');r.onsuccess=()=>resolve(r.result);});db.close();return JSON.parse(result.values['compass-session-v2']).access_token==='rotated-winner';},{polling:100});
   await pending[1](loserStatus,loserStatus===200?{...session('a'),access_token:'late-loser',refresh_token:'late-loser-refresh'}:{code:'refresh_token_already_used',msg:'Invalid Refresh Token: Already Used'});
   for(const p of[a,b]){await p.bringToFront();await p.waitForSelector('.avatar');await new Promise(r=>setTimeout(r,100));assert.equal((await readSession(p)).access_token,winner.access_token);await p.reload();await p.waitForSelector('.avatar');assert.equal((await readSession(p)).refresh_token,winner.refresh_token);}
   assert.deepEqual(errors,[]);await ctx.close();
  }
 }finally{await browser?.close();server.kill();}
});
