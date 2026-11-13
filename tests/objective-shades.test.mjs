import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import puppeteer from 'puppeteer-core';

// Ben's feedback (2 Nov, section 1.3): Awareness, Consideration and
// Performance use three related neutral shades (black, dark grey, light
// grey), and a selected objective's KPIs inherit the same treatment so the
// relationship is obvious - including when several objectives are selected.
test('objectives use three neutral shades and their KPIs inherit them',{timeout:60000},async()=>{
 const server=process.env.HOSTED_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',b=>{out+=stripVTControlCharacters(b.toString());const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timeout);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
 const click=async(p,text)=>{const h=await p.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/\s*→$/,'')===t),text);assert.ok(h.asElement(),text);await h.asElement().click();await h.dispose()};
 for(const theme of['dark','light']){
  const p=await browser.newPage();await p.setViewport({width:1280,height:900});await p.goto(url);await p.waitForSelector('.navlinks');
  if(theme==='light'){await p.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('light'))?.click()});await p.waitForFunction(()=>document.documentElement.getAttribute('data-theme')==='light',{timeout:8000})}
  await p.waitForSelector('[aria-labelledby=g-objective]');
  // Keep shade identity for selection; unselected Objective choices look equal.
  assert.deepEqual(await p.$$eval('[aria-labelledby=g-objective] .pill',bs=>bs.map(b=>[...b.classList].find(c=>c.startsWith('obj-')))),['obj-awareness','obj-consideration','obj-performance']);
  const offBorders=await p.$$eval('[aria-labelledby=g-objective] .pill.off',bs=>bs.map(b=>getComputedStyle(b).borderTopColor));
  assert.equal(new Set(offBorders).size,1,`unselected objective outlines differ: ${offBorders}`);
  const offText=await p.$$eval('[aria-labelledby=g-objective] .pill.off',bs=>bs.map(b=>getComputedStyle(b).color));
  assert.equal(new Set(offText).size,1,`unselected objective text differs: ${offText}`);
  assert.deepEqual(await p.$$eval('[aria-labelledby=g-objective] .pill.off',bs=>bs.map(b=>getComputedStyle(b).backgroundColor)),['rgba(0, 0, 0, 0)','rgba(0, 0, 0, 0)','rgba(0, 0, 0, 0)']);
  // Select Awareness: its pill fills with the black shade, and every KPI it
  // reveals inherits the awareness treatment.
  await click(p,'Awareness');
  const awarenessFill=theme==='dark'?'rgb(0, 0, 0)':'rgb(23, 23, 28)';
  assert.equal(await p.$eval('[aria-labelledby=g-objective] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).backgroundColor),awarenessFill);
  await p.waitForSelector('[aria-labelledby=g-kpi] .pill');
  assert.ok(await p.$$eval('[aria-labelledby=g-kpi] .pill',bs=>bs.length>=5));
  assert.ok(await p.$$eval('[aria-labelledby=g-kpi] .pill',bs=>bs.every(b=>b.classList.contains('obj-awareness'))),'all Awareness KPIs inherit its shade');
  // KPIs are shaded with their objective's colour from the outset, so the
  // grouping is visible while choosing - not only after a KPI is picked.
  assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness.off',b=>getComputedStyle(b).backgroundColor),awarenessFill,'unselected Awareness KPIs are not shaded');
  // A selected KPI fills with the same shade as its objective.
  await click(p,'Reach');
  assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).backgroundColor),awarenessFill);
  // Selection is a separate, unmistakable state on top of the shade.
  assert.notEqual(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).boxShadow),'none','selected KPI has no ring');
  assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).fontWeight),'700','selected KPI is not bold');
  // With Performance also selected, its KPIs keep their own light-grey shade
  // beside the awareness ones - the relationship stays unambiguous.
  await click(p,'Performance');
  const perfFill=theme==='dark'?'rgb(201, 199, 209)':'rgb(230, 229, 222)';
  const groups=await p.$$eval('[aria-labelledby=g-kpi] .pill',bs=>bs.map(b=>[...b.classList].find(c=>c.startsWith('obj-'))));
  assert.ok(groups.includes('obj-awareness')&&groups.includes('obj-performance'),`expected both shade groups, got ${groups}`);
  const offFills=await p.$$eval('[aria-labelledby=g-kpi] .pill.off',bs=>[...new Set(bs.map(b=>getComputedStyle(b).backgroundColor))]);
  assert.ok(offFills.length>=2,`unselected KPI groups should read as different shades: ${offFills}`);
  await click(p,'Enquiries');
  assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-performance:not(.off)',b=>getComputedStyle(b).backgroundColor),perfFill);
  assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).backgroundColor),awarenessFill);
  // Selection is a separate, unmistakable state on top of the shade.
  assert.notEqual(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).boxShadow),'none','selected KPI has no ring');
  assert.equal(await p.$eval('[aria-labelledby=g-kpi] .pill.obj-awareness:not(.off)',b=>getComputedStyle(b).fontWeight),'700','selected KPI is not bold');
  await p.close();
 }
 }finally{browser?.close();server?.kill()}
});
