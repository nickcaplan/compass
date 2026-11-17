import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
// Reuse the repository's embedded report font as a deterministic delayed webfont.
// This exercises replacement timing, not a claim of identical Google font metrics.
const font=Buffer.from(readFileSync('src/reportFont.ts','utf8').match(/brandFont = '([^']+)'/)[1],'base64');
const html=readFileSync('index.html','utf8');
const display=html.match(/fonts.googleapis.com\/css2\?[^"\n]*display=([^"&]+)/)?.[1];
test('slow optional fonts do not replace painted planner or saved-plan metrics',{timeout:60000},async()=>{
 assert.equal(display,'optional');
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try {
 const url=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('Server timeout')),10000);server.stdout.on('data',d=>{out+=d;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(t);resolve(m[0]);}});});
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const results=[];
 for(const mode of ['swap',display])for(const route of ['#/planner','#/my-plans'])for(const width of [390,1440])for(const theme of ['dark','light']){
  const context=await browser.createBrowserContext();const p=await context.newPage();await p.setViewport({width,height:900});await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await p.evaluateOnNewDocument(theme=>{localStorage.setItem('compass-theme',theme);window.shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.shifts.push({value:e.value,time:e.startTime});}).observe({type:'layout-shift',buffered:true});},theme);
  await p.setRequestInterception(true);p.on('request',r=>{
   if(r.url().includes('fonts.googleapis.com'))return r.respond({status:200,contentType:'text/css',body:`@font-face{font-family:Roboto;font-style:normal;font-weight:100 900;font-display:${mode};src:url(https://fonts.gstatic.com/stability-fixture.ttf) format('truetype')}@font-face{font-family:Poppins;font-style:normal;font-weight:100 900;font-display:${mode};src:url(https://fonts.gstatic.com/stability-fixture.ttf) format('truetype')}`});
   if(r.url().includes('fonts.gstatic.com'))return setTimeout(()=>void r.respond({status:200,contentType:'font/ttf',headers:{'access-control-allow-origin':'*'},body:font}).catch(()=>{}),800);
   if(r.url().includes('supabase.co'))return r.abort();return r.continue();
  });
  await p.goto(url+route);await p.waitForSelector(route.includes('my-plans')?'.plancard':'#f-name');
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const before=await p.$eval('nav',e=>({y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height}));
  await p.evaluate(()=>document.fonts.ready);await new Promise(resolve=>setTimeout(resolve,250));
  const after=await p.$eval('nav',e=>({y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height}));
  const shifts=await p.evaluate(()=>window.shifts);const cls=shifts.reduce((s,e)=>s+e.value,0);results.push({mode,route,width,theme,cls});
  if(mode==='optional'){assert.deepEqual(after,before,`${route}/${width}/${theme} nav geometry`);assert.ok(cls<0.01,`${route}/${width}/${theme} late CLS ${cls}`);}
  if(process.env.FONT_SCREENSHOT_DIR&&width===390&&theme==='dark')await p.screenshot({path:`${process.env.FONT_SCREENSHOT_DIR}/${mode}-${route.slice(2)}.png`});
  await context.close();
 }
 console.log(JSON.stringify(results));assert.ok(results.some(r=>r.mode==='swap'&&r.cls>0.01),'swap control must reproduce a visible shift');
 } finally {await browser?.close();server.kill();}
});
