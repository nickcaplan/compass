import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
test('data review slice dropdowns: placeholders, pointer and keyboard selection, no native select',async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);server.stdout.on('data',chunk=>{out+=stripVTControlCharacters(chunk.toString());const match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});server.once('error',reject)});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  await page.goto(url+'data-review');await page.waitForSelector('.inventory-review');
  // placeholders, no native select, results gated
  assert.deepEqual(await page.$$eval('.ir-dd-btn',bs=>bs.map(b=>b.textContent.trim().replace(/\s+/g,' '))),['Select...','Select...']);
  assert.equal(await page.$('.inventory-review select'),null);
  assert.match(await page.$eval('.ir-empty.ir-start',e=>e.textContent),/Select a market and objective/);
  assert.equal(await page.$('.ir-results-head'),null);
  // pointer: open market, ARIA wiring, pick UK
  await page.click('#market');await page.waitForSelector('.ir-dd-list');
  assert.equal(await page.$eval('#market',b=>b.getAttribute('aria-expanded')),'true');
  assert.equal(await page.$eval('#market',b=>b.getAttribute('aria-haspopup')),'listbox');
  assert.equal((await page.$$('.ir-dd-list [role="option"]')).length,5);
  assert.equal(await page.$eval('.ir-dd-list',l=>l.getAttribute('aria-labelledby')),'market-label');
  await page.click('#market-opt-UK');
  assert.match(await page.$eval('#market',b=>b.textContent),/UK/);
  assert.equal(await page.$eval('#market',b=>b.getAttribute('aria-expanded')),'false');
  assert.equal(await page.$('.ir-dd-list'),null);
  // still gated until both chosen
  assert(await page.$('.ir-empty.ir-start'));
  // keyboard: objective via ArrowDown/ArrowDown/Enter
  await page.focus('#objective');await page.keyboard.press('ArrowDown');await page.waitForSelector('.ir-dd-list');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.match(await page.$eval('#objective',b=>b.textContent),/Consideration/);
  await page.keyboard.press('ArrowDown');await page.waitForSelector('.ir-dd-list');
  assert.equal(await page.$eval('#objective-opt-Consideration',o=>o.getAttribute('aria-selected')),'true');
  assert.equal(await page.$eval('#objective',b=>b.getAttribute('aria-activedescendant')),'objective-opt-Consideration');
  await page.keyboard.press('Escape');
  // both chosen: results appear
  await page.waitForSelector('.ir-results-head');
  assert.match(await page.$eval('.ir-results-head h2',e=>e.textContent),/inspection option/);
  assert.equal(await page.$('.ir-empty.ir-start'),null);
  // Escape closes without changing the value
  await page.click('#market');await page.waitForSelector('.ir-dd-list');await page.keyboard.press('Escape');
  assert.equal(await page.$('.ir-dd-list'),null);
  assert.match(await page.$eval('#market',b=>b.textContent),/UK/);
  // outside pointer closes
  await page.click('#market');await page.waitForSelector('.ir-dd-list');await page.click('.ir-results-head');await page.waitForFunction(()=>!document.querySelector('.ir-dd-list'));
  assert.equal(await page.$('.ir-dd-list'),null);
  // keyboard selection flow: UK + Awareness gives the known 7 options
  await page.focus('#objective');await page.keyboard.press('Enter');await page.waitForSelector('.ir-dd-list');
  await page.keyboard.press('Home');await page.keyboard.press('Enter');
  assert.match(await page.$eval('#objective',b=>b.textContent),/Awareness/);
  await page.waitForFunction(()=>document.querySelector('.ir-results-head h2')?.textContent.includes('7 inspection options'));
 }finally{try{if(browser)await browser.close()}finally{server.kill('SIGTERM')}}
});
