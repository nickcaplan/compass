import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
// The 27 Nov workbook imports with no structural problems, so the report shows its clean state.
test('data problems report is clean for the 27 Nov workbook',async()=>{
 const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));
 assert.equal(records.filter(r=>r.structural_issues.length).length,0);
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);server.stdout.on('data',c=>{out+=stripVTControlCharacters(c.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}});server.once('error',reject)});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await browser.newPage();
 await p.goto(url+'data-review/issues');await p.waitForSelector('.inventory-review');
 assert.equal(await p.$eval('h1',e=>e.textContent),'Data problems');
 assert.equal(await p.evaluate(()=>document.title),'Compass - Data problems');
 assert.match(await p.$eval('main',e=>e.textContent),/0 of 1,745 imported rows need review/);
 assert.match(await p.$eval('.ir-empty',e=>e.textContent),/No data problems found/);
 assert.equal(await p.$('.ir-problem'),null);
 for(const width of [390,820,1440]){await p.setViewport({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 }finally{try{if(browser)await browser.close()}finally{server.kill('SIGTERM')}}
});
