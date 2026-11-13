import { seedPlannerFixture } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
test('market options preserve shared pill styling and multi-selection without regional forecast claims',{timeout:60000},async()=>{
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timeout);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
 for(const width of[320,390,768,1440]){
 const p=await browser.newPage();await p.setViewport({width,height:900});await seedPlannerFixture(p);await p.goto(url);await p.waitForSelector('[aria-labelledby=g-market]');
 assert.deepEqual(await p.$$eval('[aria-labelledby=g-market] button',bs=>bs.map(b=>b.textContent)),['North America','UK','France','Germany']);
 if(width>=1200){
  assert.deepEqual(await p.$$eval('.brief-details .planning-step label',es=>es.map(e=>e.textContent)),['Campaign name','Market','Audience','Budget','Campaign dates']);
  assert.deepEqual(await p.$$eval('.brief-goals .planning-step label',es=>es.map(e=>e.textContent)),['Objective','KPI']);
 }else assert.equal(await p.$$eval('.planning-step label',es=>es.map(e=>e.textContent).slice(1,4).join(',')),'Market,Objective,KPI');
 await p.locator('[aria-labelledby=g-market] button').click();await p.focus('[aria-labelledby=g-market] button:nth-child(2)');await p.keyboard.press('Space');
 assert.deepEqual(await p.$$eval('[aria-labelledby=g-market] button',bs=>bs.map(b=>b.getAttribute('aria-pressed'))),['true','true','false','false']);
 assert.equal(await p.$('#market-hint'),null);
 assert.equal(await p.$eval('[aria-labelledby=g-market]',e=>e.hasAttribute('aria-describedby')),false);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await p.$$eval('[aria-labelledby=g-market] button',bs=>bs.every(b=>b.getBoundingClientRect().height===document.querySelector('[aria-labelledby=g-objective] button').getBoundingClientRect().height)),true);
 if(width===390){
  const click=async text=>{const h=await p.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/\s*→$/,'')===t),text);assert.ok(h.asElement(),text);await h.asElement().click();await h.dispose()};
  await p.goto(url+'?demo=1');await p.waitForSelector('.demofill');
  await p.locator('[aria-labelledby=g-market] button').click();await click('Fill it in for me');await p.waitForSelector('[role=alertdialog]');await p.keyboard.press('Escape');await p.waitForSelector('[role=alertdialog]',{hidden:true});assert.equal(await p.$eval('[aria-labelledby=g-market] button',e=>e.getAttribute('aria-pressed')),'true');
  await click('My plans');await p.waitForSelector('[role=alertdialog]');await p.keyboard.press('Escape');await p.waitForSelector('[role=alertdialog]',{hidden:true});await click('Planner');assert.equal(await p.$eval('[aria-labelledby=g-market] button',e=>e.getAttribute('aria-pressed')),'true');
  await click('Fill it in for me');await p.waitForSelector('[role=alertdialog]');await click('Replace with example');await p.waitForSelector('.planin',{timeout:20000});const forecasts=await p.$eval('.metrics',e=>e.textContent);
  assert.deepEqual(await p.$$eval('[aria-labelledby=g-market] button',bs=>bs.map(b=>b.getAttribute('aria-pressed'))),['false','true','false','false']);
  await p.locator('[aria-labelledby=g-market] button').click();
  await click('Regenerate my plan');await p.waitForSelector('.planin',{timeout:20000});assert.equal(await p.$eval('.metrics',e=>e.textContent),forecasts);await click('Save plan');await p.waitForSelector('.bsum');
  assert.match(await p.$eval('.bsum',e=>e.textContent),/North America \+ UK/);
  const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('compass-saved-plans')));assert.deepEqual([...stored[0].brief.markets].sort(),['north-america','uk']);
  await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.bsum');assert.match(await p.$eval('.bsum',e=>e.textContent),/North America \+ UK/);
  await click('Edit plan');await p.waitForSelector('[aria-labelledby=g-market]');assert.equal(await p.$eval('[aria-labelledby=g-market] button',b=>b.getAttribute('aria-pressed')),'true');
  // Old demo records have no inferred geography, remain readable, and can be edited.
  await p.evaluate(()=>{const plans=JSON.parse(localStorage.getItem('compass-saved-plans'));delete plans[0].brief.markets;localStorage.setItem('compass-saved-plans',JSON.stringify(plans))});
  await p.reload();await p.waitForSelector('.themebtn');await click('My plans');await p.waitForSelector('.pc-actions');await click('Open plan');await p.waitForSelector('.bsum');assert.match(await p.$eval('.bsum',e=>e.textContent),/Not specified/);await click('Edit plan');await p.waitForSelector('[aria-labelledby=g-market]');assert.deepEqual(await p.$$eval('[aria-labelledby=g-market] button',bs=>bs.map(b=>b.getAttribute('aria-pressed'))),['false','false','false','false']);assert.equal(await p.$eval('.gen',e=>e.disabled),true);await p.locator('[aria-labelledby=g-market] button').click();assert.equal(await p.$eval('.gen',e=>e.disabled),false);await p.locator('[aria-labelledby=g-market] button').click();assert.equal(await p.$eval('.gen',e=>e.disabled),true);
 }
 await p.$eval('[aria-labelledby=g-market]',e=>e.scrollIntoView({block:'center'}));if(process.env.SCREENSHOT_DIR)await p.screenshot({path:`${process.env.SCREENSHOT_DIR}/markets-local-${width}.png`});await p.close();
 }
 }finally{try{await browser?.close()}finally{server?.kill()}}
});
