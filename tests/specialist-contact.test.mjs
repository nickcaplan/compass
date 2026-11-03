import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

test('specialist link preserves presentation and opens only the verified contact destination', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const local=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview not ready')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=b;const m=stripVTControlCharacters(out).match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true});
 for(const width of[390,1440]){
  const page=await browser.newPage();await page.setViewport({width,height:900});
  await page.goto((process.env.HOSTED_URL??local)+'?demo=1');await page.waitForSelector('.demofill');
  const unrelated=await page.$$eval('a[href^="mailto:"]',as=>as.map(a=>a.href));
  await page.locator('.demofill').click();await page.waitForSelector('.planin',{timeout:20000});
  assert.equal(await page.$eval('.cta b',e=>e.textContent),'A Hybrid House specialist can pick it up from here.');
  const link=await page.$('.cta a');assert.ok(link);assert.equal(await link.evaluate(e=>e.textContent.trim()),'Speak to a specialist');
  assert.deepEqual(await link.evaluate(e=>({href:e.href,target:e.target,rel:e.rel})),{href:'https://thehybridhouse.co.uk/contact/',target:'_blank',rel:'noreferrer'});
  assert.equal(await page.$('.cta button'),null);
  assert.deepEqual(await page.$$eval('a[href^="mailto:"]',as=>as.map(a=>a.href)),unrelated);
  await page.evaluate(async()=>{await Promise.all(document.querySelector('.planin').getAnimations({subtree:true}).map(a=>a.finished))});
  await link.evaluate(e=>e.scrollIntoView({block:'center'}));await link.hover();await link.focus();
  assert.deepEqual(await link.evaluate(e=>({color:getComputedStyle(e).color,decoration:getComputedStyle(e).textDecorationLine})),{color:'rgb(20, 20, 20)',decoration:'none'});
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/specialist-contact-${process.env.HOSTED_URL?'hosted':'local'}-${width}.png`});
  // Enter opens the public contact page, with no plan/query payload. No form submit.
  const targetPromise=browser.waitForTarget(t=>t.opener()===page.target());await page.keyboard.press('Enter');const target=await targetPromise;const popup=await target.page();
  await popup.waitForNetworkIdle();assert.equal(new URL(popup.url()).origin,'https://thehybridhouse.co.uk');assert.equal(new URL(popup.url()).pathname,'/contact/');assert.equal(new URL(popup.url()).search,'');
  assert.equal(await page.$('.toast'),null);await popup.close();await page.close();
 }
 }finally{await browser?.close();server.kill()}
});
