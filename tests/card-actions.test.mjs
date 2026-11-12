import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
test('saved cards keep named Delete targets apart from equal Edit/Open and full-width expired Open', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try{
  const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Preview did not start')),10000);server.stdout.on('data',chunk=>{output+=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');const match=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});server.once('error',reject);});
  browser=await puppeteer.launch({executablePath:process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of [320,390,1440]) for(const theme of ['light','dark']){
   const context=await browser.createBrowserContext();const page=await context.newPage();await page.setViewport({width,height:900});await page.goto(url+'?demo=1#/my-plans');await page.waitForSelector('.pc-delete');await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.evaluate(()=>document.fonts.ready);
   const cards=await page.$$eval('.plancard',cards=>cards.map(c=>{const box=c.getBoundingClientRect(),del=c.querySelector('.pc-delete'),d=del.getBoundingClientRect(),main=c.querySelector('.pc-main').getBoundingClientRect(),a=c.querySelector('.pc-actions').getBoundingClientRect(),button=c.querySelector('.pc-open').getBoundingClientRect();return{width:d.width,height:d.height,right:box.right-d.right,top:d.top-box.top,titleClear:main.right-48<=d.left+2,full:Math.abs(a.width-button.width)<1,expired:c.classList.contains('is-expired'),label:del.getAttribute('aria-label'),name:c.querySelector('b').textContent.trim(),actions:c.querySelectorAll('.pc-actions button').length}}));
   assert.ok(cards.length>1);for(const c of cards){assert.equal(c.width,44);assert.equal(c.height,44);assert.ok(c.right>=10&&c.right<=12);assert.ok(c.top>=10&&c.top<=12);assert.equal(c.titleClear,true);assert.equal(c.full,c.expired);assert.ok(c.label.startsWith('Delete '));assert.equal(c.actions,c.expired?1:2);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(process.env.SCREENSHOT_DIR)await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/cards-${process.env.PHASE||'after'}-${width}-${theme}.png`,fullPage:true});
   const count=await page.$$eval('.plancard',els=>els.length);const first=await page.$('.pc-delete');await first.focus();await page.keyboard.press('Enter');await page.waitForSelector('[role=alertdialog]');assert.ok((await page.$eval('[role=alertdialog]',e=>e.textContent)).includes('Delete this saved plan?'));await page.keyboard.press('Escape');await page.waitForSelector('[role=alertdialog]',{hidden:true});assert.equal(await page.$$eval('.plancard',els=>els.length),count);
   await page.click('.pc-delete');await page.waitForSelector('[role=alertdialog]');await page.click('.confirm .ghost');await page.waitForSelector('[role=alertdialog]',{hidden:true});assert.equal(await page.$$eval('.plancard',els=>els.length),count);
   await page.click('.pc-delete');await page.waitForSelector('[role=alertdialog]');await page.click('.confirm .btn');await page.waitForFunction(n=>document.querySelectorAll('.plancard').length===n-1,{},count);await page.reload();await page.waitForSelector('.pc-delete');assert.equal(await page.$$eval('.plancard',els=>els.length),count-1);await page.click('.pc-open');await page.waitForSelector('.bsum');assert.ok((await page.$eval('h1',e=>e.textContent)).trim());await context.close();
  }
 }finally{await browser?.close();server.kill();}
});
