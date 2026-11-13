import { seedPlannerFixture } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {stripVTControlCharacters} from 'node:util';
test('desktop brief fills its canvas, keeps Objective above KPI and completes manual generation and save', {timeout:90000}, async()=>{
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0']);let browser;
 try{
 const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);server.once('error',reject);server.stdout.on('data',d=>{output+=stripVTControlCharacters(d.toString());const m=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox']});
 for(const width of[390,1280,1440,1920])for(const theme of['dark','light']){
 const c=await browser.createBrowserContext(),p=await c.newPage();await seedPlannerFixture(p);await p.setViewport({width,height:1000});await p.evaluateOnNewDocument(t=>localStorage.setItem('compass-theme',t),theme);await p.goto(url+'#/planner');await p.waitForSelector('#f-name');await p.evaluate(()=>document.fonts.ready);
 const g=await p.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {layout:rect('.layout'),form:rect('.form'),objective:rect('#g-objective'),kpi:rect('#g-kpi'),audience:rect('#g-audience'),emptyVisible:document.querySelector('.plan').offsetWidth>0,overflow:document.documentElement.scrollWidth>innerWidth}});
 assert.equal(g.overflow,false);if(width>=1200){assert.equal(g.form.width,g.layout.width);assert.ok(g.kpi.y>g.objective.y);assert.equal(g.kpi.x,g.objective.x);assert.ok(g.objective.x>g.form.x+g.form.width/4);assert.equal(g.emptyVisible,false)}else assert.equal(g.emptyVisible,true);

 await p.evaluate(()=>{window.progressRegion=document.querySelector('.brief-status');window.progressChanges=[];new MutationObserver(()=>window.progressChanges.push(window.progressRegion.textContent.trim())).observe(window.progressRegion,{childList:true,subtree:true,characterData:true})});
 assert.equal(await p.$eval('.brief-status',e=>e.textContent.trim()),'');
 if(width>=1200)assert.notEqual(await p.$eval('.brief-status',e=>getComputedStyle(e).display),'none');else assert.equal(await p.$eval('.brief-status',e=>getComputedStyle(e).display),'none');
 await p.locator('[aria-labelledby=g-market] button').click();await p.waitForFunction(()=>window.progressRegion.textContent.includes('1 OF 6 ANSWERED'));
 await p.locator('[aria-labelledby=g-market] button').click();await p.waitForFunction(()=>window.progressRegion.textContent.includes('0 OF 6 ANSWERED'));
 assert.equal(await p.evaluate(()=>window.progressRegion===document.querySelector('.brief-status')),true);assert.deepEqual(await p.evaluate(()=>window.progressChanges),['1 OF 6 ANSWERED','0 OF 6 ANSWERED']);
 assert.equal(await p.$$('.plan .skel').then(es=>es.length),0,'partly filled summary must not reserve blank result blocks');
 await p.type('#f-name','Manual campaign');await p.locator('[aria-labelledby=g-market] button').click();if(width>=1200){await p.waitForSelector('.brief-progress',{visible:true});assert.match(await p.$eval('.brief-progress',e=>e.textContent),/1 OF 6 ANSWERED/);assert.equal(await p.$eval('.gen',e=>e.disabled),true)}await p.locator('[aria-labelledby=g-objective] button').click();await p.waitForSelector('[aria-labelledby=g-kpi] button');await p.locator('[aria-labelledby=g-kpi] button').click();await p.locator('[aria-labelledby=g-audience] button').click();await p.locator('#f-budget').fill('50000');
 const date=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 for(const[label,value]of[['Start date',date(30)],['End date',date(90)]])await p.$eval(`input[aria-label="${label}"]`,(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},value);
 if(width>=1200)assert.match(await p.$eval('.brief-progress',e=>e.textContent),/6 OF 6 ANSWERED/);assert.equal(await p.$eval('.gen',e=>e.disabled),false);await p.locator('.gen').click();await p.waitForSelector('.metrics');assert.equal(await p.$eval('.plan',e=>e.offsetWidth>0),true);await p.locator('.secondary .lead').click();await p.waitForSelector('.bsum');assert.match(await p.$eval('h1',e=>e.textContent),/Manual campaign/);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.name),'Manual campaign');await p.reload();await p.waitForSelector('.bsum');assert.match(await p.$eval('h1',e=>e.textContent),/Manual campaign/);await c.close();
 }
 }finally{await browser?.close();server?.kill()}
});
