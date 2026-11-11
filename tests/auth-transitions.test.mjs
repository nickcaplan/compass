import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import {seedSession,readSession} from './helpers/auth-fixtures.mjs';
const user=id=>({id,email:id+'@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{full_name:id,compass_profile_complete:true},created_at:'2026-01-01'});
const session=id=>({user:user(id),access_token:'fixture-'+id,refresh_token:'fixture-refresh-'+id,expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer'});
const until=async(fn)=>{const end=Date.now()+5000;while(!fn()){if(Date.now()>end)throw Error('Held request not reached');await new Promise(r=>setTimeout(r,10));}};

test('signup, refresh, logout and same-account return reject superseded completions', {timeout:60000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Preview not ready')),10000);server.once('error',reject);server.stdout.on('data',c=>{text+=stripVTControlCharacters(c.toString());const m=text.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox']});
 for(const method of ['signup','refresh','logout','same-account-profile']){
  const ctx=await browser.createBrowserContext(),a=await ctx.newPage(),b=await ctx.newPage();let release,armed=false;const errors=[];
  for(const p of[a,b]){p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(r.url().includes('/src/authController.ts')){void fetch(r.url()).then(x=>x.text()).then(body=>r.respond({status:200,contentType:'application/javascript',body:body+`
for(const method of ['redirect','getSession','signOut','isCurrent']){const original=AuthController.prototype[method];AuthController.prototype[method]=async function(...args){try{return await original.apply(this,args)}finally{if(window.fixtureReleased&&method===${JSON.stringify(method==='signup'?'redirect':method==='refresh'?'getSession':method==='logout'?'signOut':'isCurrent')})window.fixtureSettled=true}}}`}));return;}if(!r.url().includes('supabase.co'))return r.continue();const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'*'};if(r.method()==='OPTIONS')return r.respond({status:204,headers});const respond=()=>r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(r.url().includes('/user')?(method==='same-account-profile'&&r.method()!=='PUT'?{...user('a'),user_metadata:{}}:user('a')):r.url().includes('/logout')?{}:session('a'))});const target=method==='signup'?r.url().includes('/signup'):method==='refresh'?r.url().includes('/token'):method==='logout'?r.url().includes('/logout'):r.method()==='PUT';if(p===a&&armed&&target){release=respond;return;}return respond();});await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');}
  const saved=await a.evaluate(()=>localStorage.getItem('compass-saved-plans'));await a.bringToFront();
  if(method==='signup'){await a.locator('.signin').click();await a.evaluate(()=>[...document.querySelectorAll('.email-modes button')].find(e=>e.textContent==='Create account').click());await a.locator('#f-signin-email').fill('a@example.com');await a.locator('#f-signin-password').fill('fixture-only-password');armed=true;await a.locator('form .gen').click();}
  if(method==='refresh'){await seedSession(a,{...session('a'),expires_at:Math.floor(Date.now()/1000)-10},{notify:false});armed=true;await a.reload();}
  if(method==='logout'){await seedSession(a,session('a'));await a.waitForFunction(()=>!!document.querySelector('.avatar'));await a.locator('.signin').click();armed=true;await a.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Log out').click());}
  if(method==='same-account-profile'){await seedSession(a,{...session('a'),user:{...user('a'),user_metadata:{}}});await a.reload();await a.locator('.signin').click();await a.waitForSelector('#f-signin-profile-name');await a.locator('#f-signin-profile-name').fill('Old attempt');armed=true;await a.locator('form .gen').click();}
  await until(()=>release);
  const replacement=method==='same-account-profile'?{...session('a'),access_token:'new-a-token',user:{...user('a'),user_metadata:{}}}:session('b');
  await seedSession(b,null);await seedSession(b,replacement);await a.evaluate(()=>{window.fixtureReleased=true});await release();await a.bringToFront();if(method==='same-account-profile')await a.waitForFunction(()=>!document.querySelector('form .gen')?.textContent.includes('Saving details'));else await a.waitForFunction(()=>window.fixtureSettled);assert.equal((await readSession(a)).access_token,replacement.access_token,method+' stale storage write rejected');
  if(method==='same-account-profile'){assert.equal((await readSession(a)).user.user_metadata.compass_profile_complete,undefined);}
  await a.reload();await a.waitForFunction(email=>document.querySelector('.signin')?.getAttribute('aria-label')?.includes(email),{polling:100},replacement.user.email);
  if(method==='same-account-profile'){await a.locator('.signin').click();await a.waitForSelector('#f-signin-profile-name');assert.equal(await a.$eval('#f-signin-profile-name',e=>e.value),'','Late profile must not complete newer same-account session');}
  assert.equal(await a.evaluate(()=>localStorage.getItem('compass-saved-plans')),saved);assert.deepEqual(errors,[]);await ctx.close();
 }
 }finally{await browser?.close();server.kill();}
});
