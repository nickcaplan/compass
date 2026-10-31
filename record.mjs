import puppeteer from 'puppeteer-core';
import fs from 'fs';

const FRAMES = '/tmp/frames';
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// Screencast via CDP
const client = await page.createCDPSession();
let idx = 0;
client.on('Page.screencastFrame', async (e) => {
  fs.writeFileSync(`${FRAMES}/f${String(idx++).padStart(5, '0')}.jpg`, Buffer.from(e.data, 'base64'));
  try { await client.send('Page.screencastFrameAck', { sessionId: e.sessionId }); } catch {}
});

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
await client.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 });

// 1. Empty state hold
await sleep(2500);

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

// 4. Seniority pills: click Manager and Senior Manager / Head
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('.pill'));
  pills.find((p) => p.textContent === 'Manager')?.click();
});
await sleep(500);
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('.pill'));
  pills.find((p) => p.textContent === 'Senior Manager / Head')?.click();
});
await sleep(700);

// 5. Budget
await page.click('#f-budget');
await page.type('#f-budget', '100000', { delay: 60 });
await sleep(600);

// 6. Dates via native setter + input event
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

// 7. Generate
await page.click('.gen');
await sleep(4500); // generating ticks, then plan

// 8. Plan: gentle scroll of the plan panel
await page.evaluate(() => {
  const el = document.querySelector('.card.plan .planbody, .card.plan');
  if (el) el.scrollIntoView();
});
await sleep(1500);
await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' }));
await sleep(2200);
await page.evaluate(() => window.scrollBy({ top: -260, behavior: 'smooth' }));
await sleep(1200);

// 9. Toast on a full-product action (Export PPTX button)
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => /export|pptx|download/i.test(x.textContent));
  b?.click();
});
await sleep(2600);

await client.send('Page.stopScreencast');
await sleep(400);
await browser.close();
console.log('frames:', idx);
