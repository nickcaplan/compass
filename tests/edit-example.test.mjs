import { seedPlannerFixture } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
const brief={name:'Existing campaign',objectives:['awareness'],markets:['uk'],kpis:['Reach','Impressions'],audiences:['Scientist / Researcher'],budget:150000,start:'2026-12-09',end:'2027-03-02'};
async function click(p,label){await p.evaluate(()=>document.fonts.ready);await p.waitForSelector('.toast',{hidden:true});await p.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim().replace(/\s*→$/,'')===label),{},label);const h=await p.evaluateHandle(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/\s*→$/,'')===label),label);assert.ok(h.asElement(),label);await h.asElement().asLocator().click();await h.dispose()}
test('example fill remains for new plans, never while editing saved plans',{timeout:90000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let b;
 try{const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let o='';const timer=setTimeout(()=>reject(Error('preview timeout')),10000);s.stdout.on('data',c=>{o+=stripVTControlCharacters(c.toString());const m=o.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 for(const width of[390,1440])for(const theme of['light','dark']){
 const c=await b.createBrowserContext();const p=await c.newPage();await seedPlannerFixture(p);p.setDefaultTimeout(15000);await p.setViewport({width,height:900});await p.goto(url+'?demo=1');await p.evaluate(({brief,theme})=>{localStorage.setItem('compass-theme',theme);localStorage.setItem('compass-demo-seeded-v2','1');localStorage.setItem('compass-saved-plans',JSON.stringify([{id:'existing-plan',savedAt:'2026-11-09T14:00:00Z',brief}]))},{brief,theme});await p.reload();await p.waitForFunction(()=>location.hash==='#/planner');await p.waitForSelector('.demofill');
 await click(p,'My plans');await click(p,'Open plan');await p.waitForSelector('.bsum');await click(p,'Edit plan');await p.waitForSelector('#f-name');assert.equal(await p.$('.demofill'),null);assert.equal(await p.$('.demohint'),null);assert.equal(await p.$eval('#f-name',e=>e.value),brief.name);
 await p.locator('#f-name').fill('My changed campaign');await click(p,'My plans');await click(p,'Planner');assert.equal(await p.$('.demofill'),null);assert.equal(await p.$eval('#f-name',e=>e.value),'My changed campaign');
 await click(p,'Cancel');await p.waitForSelector('.bsum');await click(p,'Create another');await p.waitForSelector('.demofill');await click(p,'Fill it in for me');await p.waitForSelector('.planin .metrics',{timeout:20000});await click(p,'Save plan');await p.waitForSelector('.bsum');await click(p,'Edit plan');assert.equal(await p.$('.demofill'),null);await click(p,'Cancel');await click(p,'Create another');await p.waitForSelector('.demofill');
 if(process.env.DIRECT_URL){await p.goto(url+'?demo=1#/planner/existing-plan');await p.waitForSelector('.bsum');await click(p,'Edit plan');assert.equal(await p.$('.demofill'),null);assert.equal(await p.$('.demohint'),null);assert.equal(await p.$eval('#f-name',e=>e.value),brief.name)}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await c.close();
 }
 }finally{await b?.close();s.kill()}
});
