import { seedPlannerFixture } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';

// Ben's 27 Nov brief: "Restore clickable KPI and audience controls"; Nick, 28 Nov:
// go with Ben's direction. Choosing an objective selects its KPIs (Ben's workbook
// names); each KPI chip can then be clicked off or on to narrow the options.
test('KPI chips use the workbook names, start selected and can be clicked',{timeout:100000},async()=>{
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{out+=stripVTControlCharacters(d.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(t);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const c=await browser.createBrowserContext(),p=await c.newPage();p.setDefaultTimeout(10000);
 await p.setViewport({width:1440,height:1000});await seedPlannerFixture(p);await p.goto(url+'#/planner');await p.waitForSelector('[aria-labelledby=g-objective]');await p.evaluate(()=>document.fonts.ready);
 const chips=()=>p.$$eval('[aria-labelledby=g-kpi] .pill',es=>es.map(e=>e.textContent));
 const pressed=()=>p.$$eval('[aria-labelledby=g-kpi] .pill',es=>es.map(e=>e.getAttribute('aria-pressed')));
 assert.equal(await p.$eval('.kpi-content .hint',e=>e.textContent),'Select an objective first');
 await p.locator('[aria-labelledby=g-objective] button:nth-child(1)').click();
 await p.waitForSelector('[aria-labelledby=g-kpi] .pill');
 assert.deepEqual(await chips(),['Reach','Impressions','Clicks','Listens']);
 assert.deepEqual(await pressed(),['true','true','true','true']);
 assert.equal(await p.$eval('.kpi-note',e=>e.textContent),'Click to narrow the options');
 assert.match(await p.$eval('.brief-progress',e=>e.textContent),/2 OF 6 ANSWERED/);
 // Click Clicks off, then on again.
 await p.locator('[aria-labelledby=g-kpi] .pill:nth-child(3)').click();
 assert.deepEqual(await pressed(),['true','true','false','true']);
 await p.locator('[aria-labelledby=g-kpi] .pill:nth-child(3)').click();
 assert.deepEqual(await pressed(),['true','true','true','true']);
 // A second objective adds its own KPIs; shared names (Clicks, Impressions) appear once.
 await p.locator('[aria-labelledby=g-kpi] .pill:nth-child(1)').click();
 await p.locator('[aria-labelledby=g-objective] button:nth-child(3)').click();
 await p.waitForFunction(()=>document.querySelectorAll('[aria-labelledby=g-kpi] .pill').length===5);
 assert.deepEqual(await chips(),['Reach','Impressions','Clicks','Listens','CPL']);
 assert.deepEqual(await pressed(),['false','true','true','true','true'],'a KPI clicked off stays off when another objective is added');
 // Removing an objective withdraws the KPIs only it offers.
 await p.locator('[aria-labelledby=g-objective] button:nth-child(1)').click();
 await p.waitForFunction(()=>document.querySelectorAll('[aria-labelledby=g-kpi] .pill').length===1);
 assert.deepEqual(await chips(),['CPL']);
 // With every KPI off the brief is incomplete.
 await p.locator('[aria-labelledby=g-kpi] .pill').click();
 assert.match(await p.$eval('.brief-progress',e=>e.textContent),/1 OF 6 ANSWERED/);
 await p.locator('[aria-labelledby=g-objective] button:nth-child(3)').click();
 await p.waitForSelector('.kpi-content .hint');
 await c.close();

 // A full plan: Performance only offers CPL, and the options use one pick per tactic.
 const c2=await browser.createBrowserContext(),p2=await c2.newPage();p2.setDefaultTimeout(10000);
 await p2.setViewport({width:1440,height:1000});await seedPlannerFixture(p2);await p2.goto(url+'#/planner');await p2.waitForSelector('[aria-labelledby=g-objective]');
 await p2.type('#f-name','Clickable KPI campaign');
 await p2.locator('[aria-labelledby=g-market] button').click();
 await p2.locator('[aria-labelledby=g-objective] button:nth-child(3)').click();
 await p2.waitForSelector('[aria-labelledby=g-kpi] .pill');
 await p2.locator('[aria-labelledby=g-audience] button').click();
 await p2.locator('#f-budget').fill('50000');
 const iso=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 for(const[label,value]of[['Start date',iso(30)],['End date',iso(90)]])await p2.$eval(`input[aria-label="${label}"]`,(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},value);
 assert.equal(await p2.$eval('.gen',e=>e.disabled),false);
 await p2.locator('.gen').click();
 await p2.waitForSelector('.sp-results',{timeout:30000});
 assert.equal(await p2.$$eval('.sp-market',e=>e.length),1);
 assert.match(await p2.$eval('.sp-results',e=>e.textContent),/Recommended options total \$/);
 await c2.close();

 // An older saved plan keeps its stored KPIs read-only; retired KPI names fall back on edit.
 const legacy={id:'legacy-kpi',savedAt:new Date().toISOString(),brief:{name:'Legacy KPI plan',objectives:['awareness'],markets:['uk'],kpis:['Audience penetration'],audiences:['Procurement'],budget:40000,start:iso(30),end:iso(90)}};
 const c3=await browser.createBrowserContext(),p3=await c3.newPage();p3.setDefaultTimeout(10000);
 await p3.setViewport({width:1440,height:1000});await seedPlannerFixture(p3);
 await p3.evaluateOnNewDocument(plan=>localStorage.setItem('compass-saved-plans',JSON.stringify([plan])),legacy);
 await p3.goto(url+'#/my-plans');await p3.waitForSelector('.pc-actions .pc-open');
 await p3.locator('.pc-actions .pc-open').click();await p3.waitForSelector('.bsum');
 const kpiRow=await p3.$$eval('.bsum>div',ds=>ds.find(d=>d.querySelector('.k')?.textContent==='KPI')?.querySelector('.v')?.textContent);
 assert.equal(kpiRow,'Audience penetration','read-only view keeps the stored KPIs');
 await p3.locator('.saved-plan-edit').click();await p3.waitForSelector('#f-name');
 await p3.waitForFunction(()=>document.querySelectorAll('[aria-labelledby=g-kpi] .pill[aria-pressed=true]').length===4);
 await c3.close();
 }finally{await browser?.close();server?.kill()}
});
