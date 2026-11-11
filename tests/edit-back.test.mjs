import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

test('Edit Back returns to its entry page, keeps Forward and guards changed edits once', { timeout: 90000 }, async () => {
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try {
  const url=process.env.HOSTED_URL||await new Promise(resolve=>{let out='';server.stdout.on('data',d=>{out+=stripVTControlCharacters(d.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m)resolve(m[0])})});
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of[390,1440])for(const theme of['light','dark'])for(const method of['browser','inpage']){
   const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   await page.goto(url+'?demo=1#/my-plans');await page.waitForSelector('.plancard');await page.waitForSelector('.toast',{hidden:true});await page.evaluate(t=>{localStorage.setItem('compass-theme',t);document.documentElement.dataset.theme=t},theme);
   await page.$$eval('.pc-actions button',bs=>bs.find(b=>/Open plan/.test(b.textContent)).click());await page.waitForSelector('.saved-plan-edit');const viewUrl=page.url();
   await page.evaluate(()=>document.fonts.ready);if(method==='browser'){const editButton=await page.$('.saved-plan-edit');await editButton.focus();assert.equal(await page.$eval('.saved-plan-edit',e=>document.activeElement===e),true);await page.keyboard.press('Enter')}else{await page.locator('.saved-plan-edit').click()}await page.waitForSelector('#f-name');const name=await page.$eval('#f-name',e=>e.value);
   if(!process.env.BEFORE)assert.equal(page.url(),viewUrl+'/edit');
   if(method==='browser')await page.goBack();else await page.locator('.saved-back').click();
   if(process.env.BEFORE){await page.waitForSelector('.plancard')}else{await page.waitForSelector('.bsum');assert.equal(page.url(),viewUrl);assert.equal(await page.$('#f-name'),null);assert.equal(await page.$('[role=alertdialog]'),null)}
   if(process.env.SCREENSHOT_DIR&&method==='browser')await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/back-${width}-${theme}-full.png`,fullPage:true});
   if(process.env.BEFORE){await context.close();continue}
   await page.goForward();await page.waitForSelector('#f-name');assert.equal(await page.$eval('#f-name',e=>e.value),name);
   await page.type('#f-name',' changed');if(method==='browser')await page.goBack();else await page.locator('.saved-back').click();await page.waitForSelector('[role=alertdialog]');await page.keyboard.press('Escape');await page.waitForSelector('[role=alertdialog]',{hidden:true});assert.equal(await page.$eval('#f-name',e=>e.value),name+' changed');
   if(method==='browser')await page.goBack();else await page.locator('.saved-back').click();await page.waitForSelector('[role=alertdialog]');await page.locator('.confirm .btn').click();await page.waitForSelector('.bsum');assert.equal(page.url(),viewUrl);assert.equal(await page.$('[role=alertdialog]'),null);
   await page.goForward();await page.waitForSelector('#f-name');assert.equal(await page.$eval('#f-name',e=>e.value),name);await page.reload();await page.waitForSelector('#f-name');if(method==='browser')await page.goBack();else await page.locator('.saved-back').click();await page.waitForSelector('.bsum');assert.equal(page.url(),viewUrl);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
  }
 }finally{await browser?.close();server?.kill()}
});
