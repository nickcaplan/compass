import { seedPlannerFixture, handleFixtureAuthRequest } from './planner-auth-fixture.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

test('specialist link preserves presentation and opens only the verified contact destination', {timeout:60000}, async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let browser;
 try{
 const local=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Preview not ready')),10000);server.once('error',reject);server.stdout.on('data',b=>{out+=b;const m=stripVTControlCharacters(out).match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
 // Pause new pages before any request so the external destination is always
 // fulfilled locally in required CI. The real URL was verified separately.
 const client=await browser.target().createCDPSession();
 client.on('Target.attachedToTarget',async event=>{
  const session=client.connection().session(event.sessionId);
  if(event.targetInfo.type==='page'){
   await session.send('Fetch.enable',{patterns:[{urlPattern:'https://thehybridhouse.co.uk/*',requestStage:'Request'}]});
   session.on('Fetch.requestPaused',async request=>{
    await session.send('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from('<!doctype html><title>Contact navigation fixture</title><h1>Contact</h1>').toString('base64')});
   });
  }
  await session.send('Runtime.runIfWaitingForDebugger');
 });
 await client.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 for(const width of[390,1440]){
  const context=await browser.createBrowserContext();const page=await context.newPage();await page.setViewport({width,height:900});
  // Required CI proves the link with fallback fonts; loaded-font visuals are
  // checked separately against the deployed preview.
  await seedPlannerFixture(page, false);
  await page.setRequestInterception(true);
  page.on('request',request=>{
   if (handleFixtureAuthRequest(request)) return;
    const host=new URL(request.url()).hostname;
   if(host==='fonts.googleapis.com'||host==='fonts.gstatic.com')void request.abort();
   else void request.continue();
  });
  await page.goto((process.env.HOSTED_URL??local)+'?demo=1');await page.waitForSelector('.demofill');
  const unrelated=await page.$$eval('a[href^="mailto:"]',as=>as.map(a=>a.href));
  await page.locator('.demofill').click();await page.waitForSelector('.planin',{timeout:20000});
  assert.equal(await page.$eval('.cta b',e=>e.textContent),'A Hybrid House specialist can pick it up from here.');
  // The parked pricing CTA also uses a.btn. Probe that shared selector
  // without exposing a new route or changing its existing presentation.
  const probe=await page.evaluateHandle(()=>{const c=document.createElement('div');c.className='cta';const a=document.createElement('a');a.className='btn';a.href='#';a.textContent='Unrelated CTA';c.append(a);document.body.append(c);return c});
  assert.equal(await probe.evaluate(c=>getComputedStyle(c.firstChild).textDecorationLine),'underline');await probe.evaluate(c=>c.remove());await probe.dispose();
  const link=await page.$('.cta a.specialist-link');assert.ok(link);assert.equal(await link.evaluate(e=>e.textContent.trim()),'Speak to a specialist');
  assert.deepEqual(await link.evaluate(e=>({href:e.href,target:e.target,rel:e.rel})),{href:'https://thehybridhouse.co.uk/contact/',target:'_blank',rel:'noreferrer'});
  assert.equal(await page.$('.cta button'),null);
  assert.deepEqual(await page.$$eval('a[href^="mailto:"]',as=>as.map(a=>a.href)),unrelated);
  await page.evaluate(async()=>{await Promise.all(document.querySelector('.planin').getAnimations({subtree:true}).map(a=>a.finished))});
  await link.evaluate(e=>e.scrollIntoView({block:'center'}));await link.hover();await link.focus();
  assert.deepEqual(await link.evaluate(e=>({color:getComputedStyle(e).color,decoration:getComputedStyle(e).textDecorationLine})),{color:'rgb(20, 20, 20)',decoration:'none'});
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/specialist-contact-${process.env.HOSTED_URL?'hosted':'local'}-${width}.png`});
  // Enter must open the expected external URL in a new tab, with no payload.
  const targetPromise=browser.waitForTarget(t=>t.opener()===page.target());await page.keyboard.press('Enter');const target=await targetPromise;const popup=await target.page();
  await popup.waitForSelector('h1');assert.equal(await popup.title(),'Contact navigation fixture');assert.equal(new URL(popup.url()).origin,'https://thehybridhouse.co.uk');assert.equal(new URL(popup.url()).pathname,'/contact/');assert.equal(new URL(popup.url()).search,'');
  assert.equal(await page.$('.toast'),null);await popup.close();await context.close();
 }
 }finally{await browser?.close();server.kill()}
});
