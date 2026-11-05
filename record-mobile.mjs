import puppeteer from 'puppeteer-core';
import fs from 'fs';

const FRAMES = '/tmp/mframes';
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=390,844'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

// Screencast via CDP
const client = await page.createCDPSession();
let idx = 0;
client.on('Page.screencastFrame', async (e) => {
  fs.writeFileSync(`${FRAMES}/f${String(idx++).padStart(5, '0')}.jpg`, Buffer.from(e.data, 'base64'));
  try { await client.send('Page.screencastFrameAck', { sessionId: e.sessionId }); } catch {}
});

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
await client.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 });

// 1. Hero hold
await sleep(2200);
await page.evaluate(() => document.querySelector('.card.form')?.scrollIntoView({behavior:'smooth'}));
await sleep(1500);

// 2. Fill campaign name
await page.click('#f-name');
await page.type('#f-name', 'UK Laboratory Procurement Campaign - Q1 2027', { delay: 28 });
await sleep(600);

// 3. Objective -> KPI -> Audience
await page.select('#f-objective', 'awareness');
await sleep(900);
await page.select('#f-kpi', 'Reach');
await sleep(900);
await page.select('#f-audience', 'Laboratory Manager');
await sleep(900);

// 4. Budget
await page.click('#f-budget');
await page.type('#f-budget', '100000', { delay: 60 });
await sleep(600);

// 5. Dates via native setter + input event
await page.evaluate(() => {
  const set = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const [s, e] = Array.from(document.querySelectorAll('input[type=date]'));
  set(s, '2027-01-05');
  set(e, '2027-03-30');
});
await sleep(1200);

// 6. Generate (scroll button into view first)
await page.evaluate(() => document.querySelector('.gen')?.scrollIntoView({behavior:'smooth', block:'center'}));
await sleep(900);
await page.click('.gen');
await sleep(4500); // generating ticks, then plan

// 7. Plan on mobile: scroll down through the plan card
await sleep(800);
await page.evaluate(() => document.querySelector('.card.plan')?.scrollIntoView({behavior:'smooth'}));
await sleep(2000);
await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
await sleep(1800);
await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
await sleep(1800);

// 8. Toast on a full-product action (Export PPTX button)
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => /export|pptx|download/i.test(x.textContent));
  b?.click();
});
await sleep(2600);

await client.send('Page.stopScreencast');
await sleep(400);
await browser.close();
console.log('frames:', idx);
