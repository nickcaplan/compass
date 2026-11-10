import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

const brief = {name:'European R&D Awareness Drive',objectives:['awareness'],markets:['uk'],kpis:['Reach','Impressions'],audiences:['Scientist / Researcher','Laboratory Technician'],budget:150000,start:'2026-12-09',end:'2027-03-02'};
const entries = ['campaign-one','campaign two/é'].map((id,i)=>({id,savedAt:'2026-11-09T14:00:00Z',brief:{...brief,name:i?'Second campaign':brief.name}}));
async function click(page,label){
 // Font completion and locator actionability keep CI clicks on the intended control.
 await page.evaluate(()=>document.fonts.ready);
 const handle=await page.evaluateHandle(label=>[...document.querySelectorAll('button')].find(b=>(label==='Copy plan link' ? b.classList.contains('saved-plan-copy') : (b.getAttribute('aria-label')||b.textContent.trim().replace(/\s*→$/,''))===label)),label);
 assert.ok(handle.asElement(),`button ${label}`);await handle.asElement().asLocator().click();await handle.dispose();
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
 // Start without a hash so the router's initial replaceState is an explicit readiness signal.
 await page.evaluate(t=>{localStorage.setItem('compass-theme',t);history.replaceState(null,'',location.pathname+location.search)},theme);await page.reload();await hash(page,'#/planner');
 await click(page,'My plans');await hash(page,'#/my-plans');await page.reload();await page.waitForSelector('.plancard');
 await click(page,'Open plan');await hash(page,'#/planner/campaign-one');await page.waitForSelector('.bsum');await page.reload();await page.waitForSelector('.bsum');assert.match(await page.$eval('.bsum',e=>e.textContent),/European R&D/);assert.equal(await page.$eval('h1',e=>e.textContent),brief.name);assert.equal(await page.$('.hero'),null);assert.equal(await page.$('.planneractions'),null);
 const actions=await page.$eval('.saved-plan-actions',group=>({width:group.getBoundingClientRect().width,buttons:[...group.querySelectorAll('button')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
 assert.equal(actions.buttons.length,1);assert.ok(actions.buttons.every(b=>b.height>=44));assert.ok(actions.buttons[0].width>=44);
 const share=await page.$eval('.saved-brief-head .saved-plan-copy',e=>({label:e.getAttribute('aria-label'),title:e.title,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));assert.equal(share.label,'Copy plan link - only works in this browser');assert.equal(share.title,'');assert.ok(share.width>=44&&share.height>=44);assert.equal(await page.$('.planlink-note'),null);assert.equal(await page.$('.share-tooltip'),null);assert.equal(await page.$$eval('.saved-plan-copy circle',es=>es.length),3);assert.equal(await page.$$eval('.planin .viewactions button',es=>es.filter(e=>e.textContent.includes('View all plans')).length),0);assert.equal(await page.$$eval('.card button',es=>es.filter(e=>e.textContent.includes('View all plans')).length),0);assert.equal(await page.$eval('.saved-page-head .saved-back',e=>e.textContent),'View all plans');assert.match(await page.$eval('.saved-create',e=>e.textContent),/Create another/);assert.equal(await page.$eval('.saved-brief-tools .cs-compact button',e=>e.getAttribute('aria-label')),'Download PDF');assert.equal(await page.$eval('.saved-brief-tools .cs-compact button',e=>e.textContent),'');assert.equal(await page.$$eval('.saved-brief-tools button',es=>es.length),2);assert.doesNotMatch(await page.$eval('.planin .secondary',e=>e.textContent),/Download PDF|Create another/);assert.equal(await page.$eval('.saved-plan-edit svg',e=>e.getAttribute('aria-hidden')),'true');
 await page.evaluate(()=>{window.history.back()});await hash(page,'#/my-plans');await page.waitForSelector('.plancard');await page.evaluate(()=>window.history.forward());await hash(page,'#/planner/campaign-one');await page.waitForSelector('.bsum');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPlanLink=text}}}));
 await click(page,'Copy plan link');await page.waitForFunction(()=>document.querySelector('.saved-plan-copy')?.getAttribute('aria-label').startsWith('Plan link copied'));assert.equal(await page.$eval('.saved-plan-copy',e=>e.innerText),'');assert.equal(await page.$$eval('.saved-plan-copy circle',es=>es.length),0);assert.equal(await page.evaluate(()=>window.copiedPlanLink),url+'?demo=1#/planner/campaign-one');
 await click(page,'Copy plan link');assert.equal(await page.$('.planlink-note'),null);
 // A repeat copy restarts the three-second success state, without a layout shift.
 const shareBox=await page.$eval('.saved-plan-copy',e=>({width:e.offsetWidth,height:e.offsetHeight}));
 await new Promise(resolve=>setTimeout(resolve,1600));
 await click(page,'Copy plan link');const copiedAt=await page.evaluate(()=>performance.now());
 await new Promise(resolve=>setTimeout(resolve,1700));
 assert.match(await page.$eval('.saved-plan-copy',e=>e.getAttribute('aria-label')),/^Plan link copied/);
 await page.waitForFunction(()=>document.querySelector('.saved-plan-copy')?.getAttribute('aria-label').startsWith('Copy plan link'));
 const elapsed=await page.evaluate(t=>performance.now()-t,copiedAt);assert.ok(elapsed>=2900&&elapsed<4500,`copy reset after ${elapsed}ms`);
 assert.equal(await page.$$eval('.saved-plan-copy circle',es=>es.length),3);
 assert.deepEqual(await page.$eval('.saved-plan-copy',e=>({width:e.offsetWidth,height:e.offsetHeight})),shareBox);

 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await click(page,'Copy plan link');await page.waitForSelector('.planlink-field');assert.equal(await page.$eval('.planlink-field',e=>e.value),url+'?demo=1#/planner/campaign-one');
 if(width===390&&theme==='dark'){
  await new Promise(resolve=>setTimeout(resolve,3200));assert.ok(await page.$('.planlink-field'));
  assert.equal(await page.$eval('.planlink-field',e=>e===document.activeElement),true);
 }
 await click(page,'Edit plan');await page.locator('#f-name').fill('Keep my unfinished edits');await click(page,'My plans');await page.waitForSelector('[role="alertdialog"]');await page.keyboard.press('Escape');await page.waitForSelector('[role="alertdialog"]',{hidden:true});await click(page,'Planner');assert.equal(await page.$eval('#f-name',e=>e.value),'Keep my unfinished edits');
 await click(page,'Cancel');await page.waitForSelector('.bsum');
 // A second plan has an encoded, nonnumeric ID. A freshly opened URL is a bookmark.
 await page.goto(url+'?demo=1#/planner/campaign%20two%2F%C3%A9');await page.waitForSelector('.bsum');assert.match(await page.$eval('.bsum',e=>e.textContent),/Second campaign/);
 // Back first restores the same saved view. Cancel twice,
 // then confirm, without duplicating or breaking the Forward history entry.
 await click(page,'Edit plan');await page.locator('#f-name').fill('Back must not lose this');
 for(let i=0;i<2;i++){
  await page.evaluate(()=>history.back());await page.waitForSelector('[role="alertdialog"]');await page.keyboard.press('Escape');await page.waitForSelector('[role="alertdialog"]',{hidden:true});await hash(page,'#/planner/campaign%20two%2F%C3%A9/edit');assert.equal(await page.$eval('#f-name',e=>e.value),'Back must not lose this');
 }
 await page.evaluate(()=>history.back());await page.waitForSelector('[role="alertdialog"]');await click(page,'Open plan');await hash(page,'#/planner/campaign%20two%2F%C3%A9');await page.waitForSelector('.bsum');await page.evaluate(()=>history.forward());await hash(page,'#/planner/campaign%20two%2F%C3%A9/edit');await page.waitForSelector('#f-name');await page.evaluate(()=>history.back());await page.waitForSelector('.bsum');await page.evaluate(()=>history.back());await hash(page,'#/planner/campaign-one');await page.waitForSelector('.bsum');await page.evaluate(()=>history.forward());await hash(page,'#/planner/campaign%20two%2F%C3%A9');await page.waitForSelector('.bsum');
 await page.goto(url+'?demo=1#/planner/deleted-plan');await page.waitForSelector('[aria-label="Plan unavailable"]');assert.match(await page.$eval('[aria-label="Plan unavailable"]',e=>e.textContent),/not a shareable link/);await click(page,'View all plans');await page.waitForSelector('.plancard');
 await page.goto(url+'?demo=1#/planner/%zz');await page.waitForSelector('[aria-label="Plan unavailable"]');await click(page,'Back to planner');await page.waitForSelector('.bsum');assert.match(await page.$eval('.bsum',e=>e.textContent),/Second campaign/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}: overflow`);
 await context.close();
 }
 const fresh=await browser.newPage();await fresh.goto(url+'?demo=1#/planner/campaign-one');await fresh.waitForSelector('[aria-label="Plan unavailable"]');
 await fresh.evaluateOnNewDocument(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')}});await fresh.reload();await fresh.waitForSelector('[aria-label="Plan unavailable"]');assert.match(await fresh.$eval('[aria-label="Plan unavailable"]',e=>e.textContent),/left untouched/);
 }finally{await browser?.close();server.kill()}
});
