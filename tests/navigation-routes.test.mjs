import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
test('My plans and sign in retain URLs on refresh and history preserves drafts', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No preview ready')),10000);server.once('error',reject);server.once('exit',code=>reject(Error(`Preview exited ${code}`)));server.stdout.on('data',chunk=>{out+=chunk;let match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0])}})});
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of [390,1440]){
   const p=await browser.newPage();await p.setViewport({width,height:900});await p.goto(url);await p.waitForSelector('#f-name');
   const click=async label=>p.evaluate(l=>[...document.querySelectorAll('nav button')].find(e=>e.textContent===l).click(),label);
   await p.locator('#f-name').fill('Keep my draft');await click('My plans');assert.equal(new URL(p.url()).hash,'#/my-plans');await click('Sign in');assert.equal(new URL(p.url()).hash,'#/sign-in');
   await p.goBack();assert.equal(new URL(p.url()).hash,'#/my-plans');await p.goBack();assert.equal(await p.$eval('#f-name',e=>e.value),'Keep my draft');
   await p.goForward();await p.reload();await p.waitForSelector('.pagecard');assert.equal(new URL(p.url()).hash,'#/my-plans');assert.match(await p.$eval('h2',e=>e.textContent),/My plans/);
   await click('Sign in');await p.reload();await p.waitForSelector('#f-signin-email');assert.equal(new URL(p.url()).hash,'#/sign-in');assert.equal(await p.$('.metrics'),null);await p.close();
  }
 }finally{await browser?.close();server.kill()}
});
