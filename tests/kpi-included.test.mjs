import { seedPlannerFixture } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';

// Nick (13 Nov 2026): "you shouldn't be able to select KPIs - you just select
// the Objective and the KPIs come for free." The KPI box lists what the chosen
// objectives include; it offers nothing to click.
test('KPIs come included with the objective and cannot be picked by hand',{timeout:90000},async()=>{
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{out+=stripVTControlCharacters(d.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(t);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox']});
 const c=await browser.createBrowserContext(),p=await c.newPage();p.setDefaultTimeout(10000);
 await p.setViewport({width:1440,height:1000});await seedPlannerFixture(p);await p.goto(url+'#/planner');await p.waitForSelector('[aria-labelledby=g-objective]');await p.evaluate(()=>document.fonts.ready);

 // Empty: only the guidance hint, nothing to pick.
 assert.equal(await p.$eval('.kpi-content .hint',e=>e.textContent),'Select an objective first');
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] .pill',es=>es.length),0);
 if(await p.$('.brief-progress'))assert.match(await p.$eval('.brief-progress',e=>e.textContent),/0 OF 6 ANSWERED/);

 // Choosing Awareness includes its five KPIs at once: read-only chips.
 await p.locator('[aria-labelledby=g-objective] button:nth-child(1)').click();
 await p.waitForSelector('[aria-labelledby=g-kpi] .pill');
 assert.deepEqual(await p.$$eval('[aria-labelledby=g-kpi] .pill',es=>es.map(e=>e.textContent)),['Reach','Impressions','Audience penetration','Video views','Brand exposure']);
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] button',es=>es.length),0,'KPIs must not be buttons');
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] [aria-pressed]',es=>es.length),0,'KPIs carry no pressed state');
 assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill',e=>getComputedStyle(e).cursor),'default');
 assert.equal(await p.$eval('.kpi-note',e=>e.textContent),'Included with your objective');
 // The KPI answer comes free with the objective on the progress meter.
 assert.match(await p.$eval('.brief-progress',e=>e.textContent),/2 OF 6 ANSWERED/);

 // A second objective includes its KPIs beside the first, each in its own shade.
 await p.locator('[aria-labelledby=g-objective] button:nth-child(3)').click();
 await p.waitForFunction(()=>document.querySelectorAll('[aria-labelledby=g-kpi] .pill').length===12);
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] .pill.obj-awareness',es=>es.length),5);
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] .pill.obj-performance',es=>es.length),7);
 assert.equal(await p.$eval('.kpi-note',e=>e.textContent),'Included with your objectives');

 // Removing an objective withdraws exactly its KPIs.
 await p.locator('[aria-labelledby=g-objective] button:nth-child(1)').click();
 await p.waitForFunction(()=>document.querySelectorAll('[aria-labelledby=g-kpi] .pill').length===7);
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] .pill.obj-awareness',es=>es.length),0);
 assert.equal(await p.$eval('.kpi-note',e=>e.textContent),'Included with your objective');
 await p.locator('[aria-labelledby=g-objective] button:nth-child(3)').click();
 await p.waitForSelector('.kpi-content .hint');
 assert.equal(await p.$$eval('[aria-labelledby=g-kpi] .pill',es=>es.length),0);
 assert.match(await p.$eval('.brief-progress',e=>e.textContent),/0 OF 6 ANSWERED/);
 await c.close();

 // A full plan can be generated without ever touching the KPI box, and the
 // generating checklist names the objective's KPIs rather than a hand-picked list.
 const c2=await browser.createBrowserContext(),p2=await c2.newPage();p2.setDefaultTimeout(10000);
 await p2.setViewport({width:1440,height:1000});await seedPlannerFixture(p2);await p2.goto(url+'#/planner');await p2.waitForSelector('[aria-labelledby=g-objective]');
 await p2.type('#f-name','Included KPI campaign');
 await p2.locator('[aria-labelledby=g-market] button').click();
 await p2.locator('[aria-labelledby=g-objective] button:nth-child(3)').click();
 await p2.waitForSelector('[aria-labelledby=g-kpi] .pill');
 await p2.locator('[aria-labelledby=g-audience] button').click();
 await p2.locator('#f-budget').fill('50000');
 const iso=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 for(const[label,value]of[['Start date',iso(30)],['End date',iso(90)]])await p2.$eval(`input[aria-label="${label}"]`,(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},value);
 assert.equal(await p2.$eval('.gen',e=>e.disabled),false);
 await p2.locator('.gen').click();
 await p2.waitForSelector('.check .row');
 assert.ok(await p2.$$eval('.check .row',rs=>rs.some(r=>/your performance KPIs/.test(r.textContent))),'checklist should name the objective KPIs');
 assert.equal(await p2.$eval('.plan .chips .chip:nth-child(2)',e=>e.textContent),'Lead generation + Cost per lead + Website visits + Qualified traffic + Downloads + Form completions + Enquiries');
 await p2.waitForSelector('.metrics',{timeout:20000});
 await c2.close();

 // An older saved plan with a hand-picked KPI subset still opens read-only
 // with its stored KPIs, edits cleanly, and normalises once regenerated.
 const legacy={id:'legacy-kpi',savedAt:new Date().toISOString(),brief:{name:'Legacy KPI plan',objectives:['awareness'],markets:['uk'],kpis:['Reach'],audiences:['Procurement'],budget:40000,start:iso(30),end:iso(90)}};
 const c3=await browser.createBrowserContext(),p3=await c3.newPage();p3.setDefaultTimeout(10000);
 await p3.setViewport({width:1440,height:1000});await seedPlannerFixture(p3);
 await p3.evaluateOnNewDocument(plan=>localStorage.setItem('compass-saved-plans',JSON.stringify([plan])),legacy);
 await p3.goto(url+'#/my-plans');await p3.waitForSelector('.pc-actions .pc-open');
 await p3.locator('.pc-actions .pc-open').click();await p3.waitForSelector('.bsum');
 const kpiRow=await p3.$$eval('.bsum>div',ds=>ds.find(d=>d.querySelector('.k')?.textContent==='KPI')?.querySelector('.v')?.textContent);
 assert.equal(kpiRow,'Reach','read-only view keeps the stored KPIs');
 await p3.locator('.saved-plan-edit').click();await p3.waitForSelector('#f-name');
 // Edit shows what the objective now includes, and leaving without touching
 // anything asks nothing.
 await p3.waitForFunction(()=>document.querySelectorAll('[aria-labelledby=g-kpi] .pill').length===5);
 await p3.locator('.navlinks button:nth-child(2)').click();await p3.waitForSelector('.pc-actions .pc-open');
 assert.equal(await p3.$('[role=alertdialog]'),null,'unchanged edit must not ask to discard');
 // Regenerate and save: the stored plan picks up the included KPI set.
 await p3.locator('.pc-actions .pc-open').click();await p3.waitForSelector('.bsum');
 await p3.locator('.saved-plan-edit').click();await p3.waitForSelector('#f-name');
 await p3.locator('.gen').click();await p3.waitForSelector('.metrics',{timeout:20000});
 await p3.locator('.secondary .lead').click();await p3.waitForSelector('.bsum');
 assert.deepEqual(await p3.evaluate(()=>JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.kpis),['Reach','Impressions','Audience penetration','Video views','Brand exposure']);
 await c3.close();
 }finally{await browser?.close();server?.kill()}
});
