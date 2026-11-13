import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import {seedSession} from './helpers/auth-fixtures.mjs';
test('aborted Google startup restores an earlier delivered link without crossing generations', {timeout:30000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No dev server')),10000);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const p=await browser.newPage();p.setDefaultTimeout(6000);
  await p.setRequestInterception(true);p.on('request',r=>r.url().includes('supabase.co')?r.abort():r.continue());await p.goto(url);await p.waitForSelector('.signin[aria-busy=false]');
  const read=()=>p.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('compass-auth-v2');r.onsuccess=()=>resolve(r.result)});const state=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('canonical');r.onsuccess=()=>resolve(r.result)});db.close();return state});
  await seedSession(p,null,{callback:'earlier-delivered-link',notify:false});
  const error=await p.evaluate(async()=>{const {supabase}=await import('/src/supabase.ts');try{await supabase.auth.signInWithOAuth({provider:'google'},()=>false)}catch(e){return e.message}});assert.match(error,/preserve/);assert.equal((await read()).callback,'earlier-delivered-link');
  await p.evaluate(async()=>{const {authController}=await import('/src/supabase.ts');window.pendingAttempt=authController.redirect(async()=>{window.started=true;await new Promise(resolve=>window.releaseAttempt=resolve);return {}},false,()=>{throw Error('abort startup')}).catch(e=>e.message)});await p.waitForFunction(()=>window.started);await seedSession(p,null,{callback:'newer-delivered-link',notify:false});await p.evaluate(()=>window.releaseAttempt());await p.evaluate(()=>window.pendingAttempt);assert.equal((await read()).callback,'newer-delivered-link');
 }finally{await browser?.close();server.kill()}
});
