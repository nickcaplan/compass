import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
test('simple problems report shows truthful counts and one-step affected rows',async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);server.stdout.on('data',c=>{out+=stripVTControlCharacters(c.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}});server.once('error',reject)});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await browser.newPage();
 await p.goto(url+'data-review/issues');await p.waitForSelector('.ir-problem');
 assert.equal(await p.$eval('h1',e=>e.textContent),'Data problems');
 const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));
 const counts=new Map();for(const r of records)for(const i of r.structural_issues)counts.set(i,(counts.get(i)||0)+1);
 assert.equal((await p.$$('.ir-problem')).length,counts.size);
 assert.equal(await p.$('select,input,.ir-filter-chip,.ir-view-switch'),null,'no filters, chips, search or modes');
 assert.match(await p.$eval('main',e=>e.textContent),/1,595 of 1,745/);
 assert.match(await p.$eval('main',e=>e.textContent),/Rows include market versions/);
 const expected=[...counts.values()].sort((a,b)=>b-a);
 const sentences=await p.$$eval('.ir-problem strong',es=>es.map(e=>e.textContent));
 assert.deepEqual(sentences.map(s=>Number(s.match(/^[\d,]+/)[0].replaceAll(',',''))),expected);
 for(let i=0;i<sentences.length;i++){
  const buttons=await p.$$('.ir-problem');await buttons[i].click();await p.waitForSelector('.ir-problem-row');
  assert.equal(await p.$eval('h1',e=>e.textContent),sentences[i]);
  assert.equal((await p.$$('.ir-problem-row')).length,Math.min(50,expected[i]));
  const token=[...counts.entries()].sort((a,b)=>b[1]-a[1])[i][0];
  assert.deepEqual(await p.$$eval('.ir-problem-row',es=>es.map(e=>e.querySelector('h2').textContent)),records.filter(r=>r.structural_issues.includes(token)).slice(0,50).map(r=>r.publisher),'detail rows belong to selected problem');
  const back=await p.$('.ir-back-problems');await back.click();await p.waitForSelector('.ir-problem');
 }
 await p.focus('.ir-problem');await p.keyboard.press('Enter');await p.waitForSelector('.ir-problem-row');
 await p.waitForFunction(()=>document.activeElement?.id==='problem-heading');
 assert.match(await p.$eval('h1',e=>e.textContent),/1,470 rows have no tactic/);
 await p.click('.ir-more');assert.equal((await p.$$('.ir-problem-row')).length,100);
 await p.click('.ir-back-problems');await p.click('.ir-problem');assert.equal((await p.$$('.ir-problem-row')).length,50,'reopening resets pagination');
 for(const width of [390,820,1440]){await p.setViewport({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.setViewport({width:390,height:844});assert.equal(await p.$eval('.ir-problem-head',e=>getComputedStyle(e).display),'none');assert.equal(await p.$eval('.ir-problem-row small',e=>getComputedStyle(e).display),'inline');
 await p.click('.ir-back-problems');await p.reload();await p.waitForSelector('.ir-problem');assert.equal(await p.$('.ir-problem-row'),null);
 await p.setViewport({width:1440,height:900});await p.click('.ir-nav a[href="/data-review"]');await p.waitForSelector('.ir-stats');
 }finally{await browser?.close();server.kill('SIGTERM')}
});
