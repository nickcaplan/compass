import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
test('auth import storage failure is visible and reload recovers without deleting data',{timeout:30000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('preview timeout')),10000);server.stdout.on('data',d=>{text+=stripVTControlCharacters(d.toString());const m=text.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox']});const p=await browser.newPage();await p.goto(url+'?demo=1');await p.waitForSelector('#f-name');await p.evaluate(()=>localStorage.setItem('storage-recovery-sentinel','kept'));
 const init=await p.evaluateOnNewDocument(()=>{window.addEventListener=()=>{throw Error('fixture import failure')}});await p.reload();await p.waitForSelector('main [role=alert]');assert.match(await p.$eval('main [role=alert]',e=>e.textContent),/saved data has been left untouched/);assert.equal(await p.$('#f-name'),null);
 await p.removeScriptToEvaluateOnNewDocument(init.identifier);await p.click('main .btn');await p.waitForSelector('#f-name');assert.equal(await p.evaluate(()=>localStorage.getItem('storage-recovery-sentinel')),'kept');
 }finally{await browser?.close();server.kill()}
});
