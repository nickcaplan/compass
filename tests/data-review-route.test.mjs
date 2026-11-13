import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
test('data review direct paths and refresh stay separate from normal planner',async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);server.stdout.on('data',chunk=>{out+=stripVTControlCharacters(chunk.toString());const match=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});server.once('error',reject)});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  for(const path of['data-review','data-review/','?inventory=1']){await page.goto(url+path);await page.waitForSelector('.inventory-review');assert.deepEqual(await page.$$eval('.ir-stats strong',es=>es.map(e=>e.textContent)),['1,745','150','0']);assert.match(await page.$eval('.ir-warning',e=>e.textContent),/Mock data/);await page.reload();await page.waitForSelector('.inventory-review');}
  await page.click('.ir-nav a');await page.waitForSelector('#f-name');assert.equal(await page.$('.inventory-review'),null);
  assert.ok(!fs.existsSync('dist/404.html'),'Cloudflare Pages must retain default SPA fallback');
 }finally{try{if(browser)await browser.close()}finally{server.kill('SIGTERM')}}
});
