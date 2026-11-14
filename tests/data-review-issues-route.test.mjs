import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
test('data review issues page lists flagged rows with column titles and wording',async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);server.stdout.on('data',chunk=>{out+=stripVTControlCharacters(chunk.toString());const match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});server.once('error',reject)});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  await page.goto(url+'data-review/issues');await page.waitForSelector('.inventory-review .ir-irow');
  assert.match(await page.$eval('.ir-page h1',e=>e.textContent),/Rows that require review/);
  const heads=await page.$$eval('.ir-ihead span',es=>es.map(e=>e.textContent));
  assert.deepEqual(heads,['Publisher / Product','Tactic','Market','Objective','Source cost','Issue']);
  const body=await page.$eval('.inventory-review',e=>e.textContent);
  assert.match(body,/1,595 of 1,745 imported rows/);
  assert.ok(!/Held|unclassified/.test(body),'no Held or unclassified wording');
  // issue filter narrows the list and offers the No tactic label
  await page.click('#f-issue');await page.waitForSelector('.ir-dd-list li');
  const options=await page.$$eval('.ir-dd-list li',es=>es.map(e=>e.textContent));
  assert.ok(options.some(o=>o.startsWith('No tactic - 1,470')),'No tactic option with count');
  await page.click('.ir-dd-list li');// first option: No tactic - 1,470
  await page.waitForFunction(()=>document.querySelector('.ir-page .ir-small')?.textContent.includes('1,470 rows'));
  assert.match(await page.$eval('.ir-irow .ir-issues',e=>e.textContent),/Review: No tactic/);
  // desktop header hides on phone, per-field labels take over
  await page.setViewport({width:390,height:844});await page.reload();await page.waitForSelector('.ir-irow');
  assert.equal(await page.$eval('.ir-ihead',e=>getComputedStyle(e).display),'none');
  assert.equal(await page.$eval('.ir-irow h4 .ir-icol',e=>getComputedStyle(e).display),'block');
  // nav back to the review page
  await page.setViewport({width:1440,height:900});
  await page.click('.ir-nav a[href="/data-review"]');await page.waitForSelector('.inventory-review .ir-stats');
 }finally{try{if(browser)await browser.close()}finally{server.kill('SIGTERM')}}
});
