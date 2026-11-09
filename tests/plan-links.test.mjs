import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

const brief = {name:'European R&D Awareness Drive',objectives:['awareness'],markets:['uk'],kpis:['Reach','Impressions'],audiences:['Scientist / Researcher','Laboratory Technician'],budget:150000,start:'2026-12-09',end:'2027-03-02'};
const entries = ['campaign-one','campaign two/é'].map((id,i)=>({id,savedAt:'2026-11-09T14:00:00Z',brief:{...brief,name:i?'Second campaign':brief.name}}));
async function click(page,label){
 const handle=await page.evaluateHandle(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/\s*→$/,'')===label),label);
 assert.ok(handle.asElement(),`button ${label}`);await handle.asElement().click();await handle.dispose();
}
async function hash(page,value){await page.waitForFunction(value=>location.hash===value,{},value)}

test('same-browser plan URLs survive refresh, history, cancellation and unavailable plans', {timeout:90000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('preview timeout')),10000);server.stdout.on('data',c=>{out+=stripVTControlCharacters(c.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 for(const width of [390,1440])for(const theme of ['light','dark']){
 const context=await browser.createBrowserContext();const page=await context.newPage();page.setDefaultTimeout(8000);await page.setViewport({width,height:900});
 await page.goto(url+'?demo=1');await page.evaluate((entries)=>{localStorage.setItem('compass-saved-plans',JSON.stringify(entries));localStorage.setItem('compass-demo-seeded-v2','1')},entries);await page.reload();
 await page.evaluate(t=>{localStorage.setItem('compass-theme',t)},theme);await page.reload();
 await click(page,'My plans');await hash(page,'#/my-plans');await page.reload();await page.waitForSelector('.plancard');
 await click(page,'Open plan');await hash(page,'#/planner/campaign-one');await page.waitForSelector('.bsum');await page.reload();await page.waitForSelector('.bsum');assert.match(await page.$eval('.bsum',e=>e.textContent),/European R&D/);
 const actions=await page.$eval('.saved-plan-actions',group=>({width:group.getBoundingClientRect().width,buttons:[...group.querySelectorAll('button')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top}))}));
 assert.equal(actions.buttons.length,3,'all saved-plan actions preserved');assert.ok(Math.abs(actions.buttons[0].width-actions.width)<1,'Edit plan fills the primary row');assert.ok(actions.buttons.every(b=>b.height>=44),'44px action targets');assert.equal(actions.buttons[1].top,actions.buttons[2].top,'navigation and copy align');assert.equal(actions.buttons[1].width,actions.buttons[2].width,'balanced utility widths');
 await page.focus('.saved-plan-edit');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'View all plans');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Copy plan link');assert.equal(await page.$eval('.saved-plan-copy',e=>e.getAttribute('aria-describedby')),'plan-link-note');
 await page.evaluate(()=>{window.history.back()});await hash(page,'#/my-plans');await page.waitForSelector('.plancard');await page.evaluate(()=>window.history.forward());await hash(page,'#/planner/campaign-one');await page.waitForSelector('.bsum');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPlanLink=text}}}));
 await click(page,'Copy plan link');await page.waitForFunction(()=>document.querySelector('.planlink-note')?.textContent.startsWith('Link copied'));assert.equal(await page.evaluate(()=>window.copiedPlanLink),url+'?demo=1#/planner/campaign-one');
 await click(page,'Copy plan link');assert.match(await page.$eval('.planlink-note',e=>e.textContent),/only works in this browser/);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await click(page,'Copy plan link');await page.waitForSelector('.planlink-field');assert.equal(await page.$eval('.planlink-field',e=>e.value),url+'?demo=1#/planner/campaign-one');
 await click(page,'Edit plan');await page.locator('#f-name').fill('Keep my unfinished edits');await click(page,'My plans');await click(page,'Open plan');await page.waitForSelector('[role="alertdialog"]');await page.keyboard.press('Escape');await page.waitForSelector('[role="alertdialog"]',{hidden:true});await click(page,'Planner');assert.equal(await page.$eval('#f-name',e=>e.value),'Keep my unfinished edits');
 await click(page,'Cancel');await page.waitForSelector('.bsum');
 // A second plan has an encoded, nonnumeric ID. A freshly opened URL is a bookmark.
 await page.goto(url+'?demo=1#/planner/campaign%20two%2F%C3%A9');await page.waitForSelector('.bsum');assert.match(await page.$eval('.bsum',e=>e.textContent),/Second campaign/);
 // Back targets a different plan while there are unsaved edits. Cancel twice,
 // then confirm, without duplicating or breaking the Forward history entry.
 await click(page,'Edit plan');await page.locator('#f-name').fill('Back must not lose this');
 for(let i=0;i<2;i++){
  await page.evaluate(()=>history.back());await page.waitForSelector('[role="alertdialog"]');await page.keyboard.press('Escape');await page.waitForSelector('[role="alertdialog"]',{hidden:true});await hash(page,'#/planner/campaign%20two%2F%C3%A9');assert.equal(await page.$eval('#f-name',e=>e.value),'Back must not lose this');
 }
 await page.evaluate(()=>history.back());await page.waitForSelector('[role="alertdialog"]');await click(page,'Open plan');await hash(page,'#/planner/campaign-one');await page.waitForSelector('.bsum');await page.evaluate(()=>history.forward());await hash(page,'#/planner/campaign%20two%2F%C3%A9');await page.waitForSelector('.bsum');
 await page.goto(url+'?demo=1#/planner/deleted-plan');await page.waitForSelector('[aria-label="Plan unavailable"]');assert.match(await page.$eval('[aria-label="Plan unavailable"]',e=>e.textContent),/not a shareable link/);await click(page,'View all plans');await page.waitForSelector('.plancard');
 await page.goto(url+'?demo=1#/planner/%zz');await page.waitForSelector('[aria-label="Plan unavailable"]');await click(page,'Back to planner');await page.waitForSelector('.bsum');assert.match(await page.$eval('.bsum',e=>e.textContent),/Second campaign/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}: overflow`);
 await context.close();
 }
 const fresh=await browser.newPage();await fresh.goto(url+'?demo=1#/planner/campaign-one');await fresh.waitForSelector('[aria-label="Plan unavailable"]');
 await fresh.evaluateOnNewDocument(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')}});await fresh.reload();await fresh.waitForSelector('[aria-label="Plan unavailable"]');assert.match(await fresh.$eval('[aria-label="Plan unavailable"]',e=>e.textContent),/left untouched/);
 }finally{await browser?.close();server.kill()}
});
