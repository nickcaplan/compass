import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';
const require=createRequire(import.meta.url);
const axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const chrome=process.env.CHROME_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome');

test('WCAG AA, keyboard focus and200% text on every route and Planner state',{timeout:180000},async()=>{
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
  const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview not ready')),10000);server.once('error',reject);server.once('exit',code=>reject(Error(`Preview exited ${code}`)));server.stdout.on('data',d=>{out+=stripVTControlCharacters(d.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
  for(const width of[390,1440])for(const theme of['dark','light'])for(const state of['empty','generated','saved','edit','plans','signin','pricing']){
   const label=`${width}/${theme}/${state}`;const context=await browser.createBrowserContext(),page=await context.newPage();
   await page.setViewport({width,height:950});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   await page.evaluateOnNewDocument(theme=>localStorage.setItem('compass-theme',theme),theme);
   const route={plans:'my-plans',saved:'my-plans',edit:'my-plans',signin:'sign-in',pricing:'pricing'}[state]||'planner';
   await page.goto(url+'?demo=1#/'+route);await page.waitForSelector('.themebtn');
   if(['saved','edit'].includes(state)){
    await page.waitForSelector('.plancard');await page.waitForSelector('.toast',{hidden:true});
    await page.$$eval('.pc-actions button',bs=>bs.find(e=>e.textContent.includes('Open plan')).click());await page.waitForSelector('.bsum');
    if(state==='edit'){await page.locator('.saved-plan-edit').click();await page.waitForSelector('#f-name')}
   }
   if(state==='generated'){
    await page.locator('.demofill').click();
    try{await page.waitForSelector('.planin',{timeout:20000})}catch(error){console.error(label,await page.evaluate(()=>({url:location.href,visibility:document.visibilityState,button:document.querySelector('.gen')?.outerHTML,text:document.body.innerText.slice(-1800)})));throw error}
   }
   await page.evaluate(()=>document.fonts.ready);await page.addScriptTag({content:axeSource});
   const violations=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,failure:n.failureSummary}))}))});
   assert.deepEqual(violations,[],`${label}: WCAG AA violations`);
   // Use real Tab traversal. Focus must remain visible and scroll into the viewport.
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});
   const count=await page.$$eval('button,input,select,a[href]',es=>es.filter(e=>!e.disabled&&e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').length);
   for(let i=0;i<count;i++){
    await page.keyboard.press('Tab');const focus=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();return{tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,60)||e.id,visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),inView:r.bottom>=0&&r.top<=innerHeight}});
    if(focus.tag==='BODY')continue;assert.ok(focus.visible&&focus.outline!=='none'&&focus.width>=2&&focus.inView,`${label}: ${JSON.stringify(focus)}`);
   }
   if(state==='plans'){
    const target=await page.$('.pc-delete');await target.focus();await page.keyboard.press('Enter');await page.waitForSelector('[role=alertdialog]');
    for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=alertdialog]'))),true,`${label}: dialog focus escaped`)}
    await page.keyboard.press('Escape');await page.waitForSelector('[role=alertdialog]',{hidden:true});assert.equal(await target.evaluate(e=>e===document.activeElement),true,`${label}: focus was not restored`);
   }
   // Snapshot sizes before assigning them, so inherited values are not doubled repeatedly.
   await page.evaluate(()=>{const sizes=[...document.querySelectorAll('*')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const[e,size]of sizes)e.style.fontSize=size*2+'px'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${label}:200% horizontal overflow`);
   const clipped=await page.$$eval('button',es=>es.filter(e=>e.clientWidth&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.trim()));assert.deepEqual(clipped,[],`${label}:200% clipped actions`);
   await context.close();
  }
 }finally{await browser?.close();server?.kill()}
});
