import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {readFileSync} from 'node:fs';
const gbpPerEur=Number(/GBP: ([\d.]+),/.exec(readFileSync('src/data.ts','utf8'))[1]);
const fallbackDate=/FX_RATE_DATE = '([^']+)'/.exec(readFileSync('src/data.ts','utf8'))[1];
import {handleFixtureAuthRequest, seedPlannerFixture} from './planner-auth-fixture.mjs';
const chrome='/usr/bin/google-chrome';
async function fill(page, objective='Consideration', markets=['UK']) {
 await page.waitForSelector('#f-name');
 await page.locator('#f-name').fill('Laboratory manager campaign');
 for(const text of [...markets,objective,'Laboratory Manager']) await page.evaluate(text=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text).click(),text);
 await page.locator('#f-budget').fill('60000');
 await page.evaluate(()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [el,val] of [...document.querySelectorAll('input[type=date]')].map((e,i)=>[e,i?'2027-03-31':'2027-01-01'])){set.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});
 await page.locator('button.gen').click();
}
test('connected source slice respects brief, units, no-auth source access, no save and legacy isolation',{timeout:180000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});let browser;
 try {
 const url=await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('Server timeout')),10000);s.stdout.on('data',d=>{out+=d;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(t);resolve(m[0]);}});});
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
 const p=await browser.newPage();await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await seedPlannerFixture(p,false);await p.setRequestInterception(true);p.on('request',r=>{if(handleFixtureAuthRequest(r))return;if(r.url().includes('data-api.ecb.europa.eu'))return r.abort();r.continue()});
 await p.goto(url);await p.waitForSelector('#f-name');assert.equal(await p.evaluate(()=>document.title),'Compass - Source options');await fill(p);await p.waitForSelector('.sp-option');
 assert.match(await p.$eval('.sp-results',e=>e.textContent),/Audience matching is pending/);
 assert.equal(await p.$('.planin .timing'),null);
 assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.planin button')].some(e=>/^Save/.test(e.textContent.trim()))),true);
 assert.equal(await p.$$eval('.sp-option',els=>els.length),23);
 const text=await p.$eval('.sp-results',e=>e.textContent);assert.match(text,new RegExp('European Central Bank reference rates, '+fallbackDate+' \\(live rates unavailable'));assert.equal(await p.$eval('.sp-market',e=>e.getAttribute('aria-label')),'UK source options');assert.match(text,/· GBP/);assert.doesNotMatch(text,/Publisher [ABC]/);assert.doesNotMatch(text,/MOCK DATA|DEMO DATA|mock data|not validated|not verified|demo volume|Illustrative source|Illustrative delivery/i);
 for(const width of [1280,1440,1920]){
  await p.setViewport({width,height:900});await p.evaluate(()=>new Promise(requestAnimationFrame));
  assert.equal(await p.$eval('.form',e=>getComputedStyle(e).position),'sticky');
  assert.ok(await p.$$eval('.sp-option',els=>els.every(e=>{const box=[...e.querySelectorAll('div')].find(d=>d.querySelector('dt')?.textContent==='Estimated cost · GBP');return /^£\d{1,3}(,\d{3})*$/.test(box?.querySelector('dd')?.textContent??'')})),'every UK source cost is a whole-number GBP market value');
  const layout=await p.evaluate(()=>[...document.querySelectorAll('.sp-options')].map(grid=>{const g=grid.getBoundingClientRect();return {grid:g.width,cards:[...grid.children].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height,width:r.width}})}}));
  for(const group of layout){for(const card of group.cards)assert.ok(card.width<=group.grid/2+1,`one card must not take the full ${width}px grid`)}
  const rowHeights=await p.$$eval('.sp-options',grids=>grids.flatMap(grid=>{const cards=[...grid.children].map(e=>e.getBoundingClientRect());const tops=[...new Set(cards.map(r=>Math.round(r.top)))];return tops.map(top=>{const row=cards.filter(r=>Math.round(r.top)===top);return Math.max(...row.map(r=>r.height))-Math.min(...row.map(r=>r.height))})}));
  assert.ok(rowHeights.every(delta=>delta<=1),`cards align by row at ${width}px`);
 }
 const before=await p.evaluate(()=>localStorage.getItem('compass-plans'));await p.reload();await p.waitForSelector('#f-name');assert.equal(await p.evaluate(()=>localStorage.getItem('compass-plans')),before);
 for(const [objective,markets,count] of [['Performance',['UK'],0],['Consideration',['UK','France'],46]]){await p.goto(url);await fill(p,objective,markets);await p.waitForSelector('.sp-results');assert.equal(await p.$$eval('.sp-option',e=>e.length),count);if(!count)assert.match(await p.$eval('.sp-results',e=>e.textContent),/No source options ready/);if(count===46){assert.deepEqual(await p.$$eval('.sp-market>header p',es=>es.map(e=>e.textContent.split('·').at(-1).trim())),['GBP','EUR']);assert.match(await p.$eval('.sp-results',e=>e.textContent),new RegExp('Budget equivalent: €'+Math.round(60000/gbpPerEur).toLocaleString('en-GB')));}}
 await p.goto(url);await fill(p);await p.waitForSelector('.sp-option');await p.locator('.sp-option summary').click();assert.equal(await p.$eval('.sp-option details',e=>e.open),true);assert.match(await p.$eval('.sp-option details',e=>e.textContent),/Existing source volume/);assert.match(await p.$eval('.sp-option details',e=>e.textContent),/Source cost: US\$[\d,]+ converted to GBP on the fly/);await p.locator('.sp-option summary').click();assert.equal(await p.$eval('.sp-option details',e=>e.open),false);
 const dir=process.env.SOURCE_SCREENSHOT_DIR;
 if(dir){await mkdir(dir,{recursive:true});for(const [mode,q] of [['after','']]){await p.goto(url+q);await fill(p);await p.waitForSelector('.sp-option');for(const width of [320,390,768,1440])for(const theme of ['dark','light'])for(const scale of [100,200]){await p.setViewport({width,height:960});await p.evaluate(({theme,scale})=>{document.documentElement.dataset.theme=theme;for(const el of document.querySelectorAll('.sp-results *')){if(el.dataset.originalStyle!==undefined){el.setAttribute('style',el.dataset.originalStyle);delete el.dataset.originalStyle;}}if(scale===200){const sizes=[...document.querySelectorAll('.sp-results *')].map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);for(const [el,size] of sizes){el.dataset.originalStyle=el.getAttribute('style')||'';el.style.fontSize=(size*2)+'px';}}},{theme,scale});await p.evaluate(()=>document.querySelector('.planhead').scrollIntoView());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${mode}/${width}/${theme}/${scale}`);if((width===390||width===1440)&&scale===100&&theme==='dark')await p.screenshot({path:`${dir}/${mode}-${width}.png`});if(mode==='after'&&width===320&&theme==='light'&&scale===200)await p.screenshot({path:`${dir}/after-320-light-200.png`});} }}
 const anonymousContext=await browser.createBrowserContext();const anon=await anonymousContext.newPage();await anon.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await anon.setRequestInterception(true);anon.on('request',r=>r.url().includes('supabase.co')?r.abort():r.continue());await anon.goto(url);await fill(anon);await anon.waitForSelector('.sp-option');assert.equal(await anon.$('#f-gate-email'),null,'source results are available without auth');
 const savedAnon=await anonymousContext.newPage();await savedAnon.setRequestInterception(true);savedAnon.on('request',r=>r.url().includes('supabase.co')?r.abort():r.continue());await savedAnon.evaluateOnNewDocument(()=>localStorage.setItem('compass-saved-plans',JSON.stringify([{id:'saved-layout',brief:{name:'Saved legacy plan',objectives:['awareness'],markets:['uk'],kpis:['Reach'],audiences:['Procurement'],budget:100000,start:'2027-02-01',end:'2027-04-01'},savedAt:'2026-11-20T12:00:00Z'}])));await savedAnon.goto(url+'#/planner/saved-layout');await savedAnon.waitForSelector('#f-gate-email');assert.equal(await savedAnon.evaluate(()=>document.title),'Compass - Plan a campaign','saved legacy plans must not be exposed without auth');
 } finally {await browser?.close();s.kill();}
});
