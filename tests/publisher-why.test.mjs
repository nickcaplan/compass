import { seedPlannerFixture } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

test('publisher explanations span the complete row without disturbing stats', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview not ready')),10000);server.once('error',reject);server.stdout.on('data',chunk=>{out+=stripVTControlCharacters(chunk.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();await seedPlannerFixture(page);await page.goto(url+'?demo=1');await page.locator('.demofill').click();await page.waitForSelector('.planin .act',{timeout:20000});await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,375,390,414,640,768,820,980,981,1000,1199,1200,1440,1920])for(const theme of ['light','dark']){
   await page.setViewport({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const rows=await page.$$eval('.act',els=>els.map(el=>{const r=el.getBoundingClientRect(),why=el.querySelector('.why').getBoundingClientRect(),style=getComputedStyle(el);const previous=[...el.children].filter(e=>!e.classList.contains('why')).map(e=>e.getBoundingClientRect());return {span:getComputedStyle(el.querySelector('.why')).gridColumn,width:why.width,available:r.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),below:previous.every(p=>p.bottom<=why.top+1),columns:style.gridTemplateColumns.split(' ').length,stats:el.querySelectorAll('.num').length}}));
   for(const row of rows){assert.equal(row.span,'1 / -1');assert.ok(Math.abs(row.width-row.available)<=1,`${width}/${theme}: explanation uses row width`);assert.ok(row.below,`${width}/${theme}: explanation below all figures`);assert.equal(row.columns,width<=980?2:4);assert.equal(row.stats,3);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}: no horizontal overflow`);
  }
 }finally{await browser?.close();server.kill()}
});
