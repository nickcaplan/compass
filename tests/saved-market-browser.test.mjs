import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import {seedPlannerFixture} from './planner-auth-fixture.mjs';

test('legacy/custom/expired saved markets persist and appear in cards, Open and Edit without changing explicit choices',{timeout:60000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0']);let b;
 try{
  let out='';const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preview startup')),10000);s.stdout.on('data',d=>{out+=stripVTControlCharacters(d.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
  b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  for(const width of[390,1440])for(const theme of['dark','light']){
   const c=await b.createBrowserContext(),p=await c.newPage();await seedPlannerFixture(p);await p.setViewport({width,height:1000});
   await p.evaluateOnNewDocument(theme=>{
    localStorage.setItem('compass-theme',theme);
    if(localStorage.getItem('saved-market-fixture'))return;
    const date=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
    const brief={name:'Custom legacy plan',objectives:['awareness'],kpis:['Reach'],audiences:['Procurement'],budget:50000,start:date(30),end:date(90)};
    localStorage.setItem('compass-saved-plans',JSON.stringify([{id:'custom',savedAt:'2026-01-01',brief},{id:'empty',savedAt:'2026-01-02',brief:{...brief,name:'Expired empty market',markets:[],start:date(-90),end:date(-30)}},{id:'explicit',savedAt:'2026-01-03',brief:{...brief,name:'Chosen markets',markets:['france','germany']}}]));
    localStorage.setItem('compass-seeded-plans',JSON.stringify({version:2,applied:['seed-active-1','seed-active-2',...Array.from({length:5},(_,i)=>'seed-past-'+(i+1))]}));localStorage.setItem('saved-market-fixture','1');
   },theme);
   await p.goto(url+'#/my-plans');await p.waitForSelector('.avatar');await p.waitForSelector('.plancard');
   assert.match(await p.$$eval('.plancard',es=>es.map(e=>e.textContent).join(' ')),/Expired empty market/);
   assert.equal(await p.$$('.plancard.is-expired').then(es=>es.length),1);
   assert.deepEqual(await p.$$eval('.pc-market',es=>es.map(e=>e.textContent)),['UK','UK','France + Germany']);
   const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('compass-saved-plans')));
   const plans=await read();assert.deepEqual(plans.map(p=>p.brief.markets),[['uk'],['uk'],['france','germany']]);assert.deepEqual(plans.map(p=>p.id),['custom','empty','explicit']);assert.equal(plans[0].savedAt,'2026-01-01');
   await p.reload();await p.waitForSelector('.plancard');assert.deepEqual(await read(),plans);
   await p.locator('.pc-actions .pc-open').click();await p.waitForSelector('.bsum');assert.match(await p.$eval('.bsum',e=>e.textContent),/MarketUK/);
   await p.locator('.saved-plan-edit').click();await p.waitForSelector('#f-name');assert.deepEqual(await p.$$eval('[aria-labelledby=g-market] [aria-pressed=true]',es=>es.map(e=>e.textContent)),['UK']);
   await p.locator('#f-budget').fill('60000');await p.locator('.gen').click();await p.waitForSelector('.metrics');await p.waitForSelector('.ghost.lead:not(:disabled)');await p.locator('.ghost.lead').click();await p.waitForSelector('.bsum');
   assert.equal((await read()).find(p=>p.id==='custom').brief.budget,60000);assert.deepEqual((await read()).find(p=>p.id==='custom').brief.markets,['uk']);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await c.close();
  }
 }finally{await b?.close();s.kill()}
});
