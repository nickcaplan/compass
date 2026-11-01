import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => server.kill());
const deadline = Date.now() + 10000;
let ready = false;
while (Date.now() < deadline) {
  try { const r = await fetch('http://127.0.0.1:4174'); await r.body?.cancel(); if (r.ok) { ready = true; break; } } catch {}
  await new Promise(r => setTimeout(r, 100));
}
if (!ready) throw new Error('server not ready');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.setViewport({ width: 412, height: 900 });
page.on('console', (m) => console.log('PAGE:', m.text().slice(0, 150)));
page.on('pageerror', (e) => console.log('PAGEERR:', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.setItem('compass-theme', 'dark'));
await page.reload({ waitUntil: 'networkidle0' });
const dump = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(() => ({
  stage: document.querySelector('.planin h2')?.textContent || null,
  buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 28)).slice(0, 12),
  secondary: document.querySelector('.secondary') ? document.querySelector('.secondary').innerHTML.slice(0, 200) : null,
}))));
await dump('LOADED');
const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/\s*→$/, '') === 'Fill it in for me'));
await handle.asElement().click();
await page.waitForFunction(() => !document.querySelector('.gen').disabled);
await page.locator('.gen').click();
await page.waitForSelector('.planin');
await dump('POST-GEN');
if (await page.$('#f-gate-name')) {
  await page.locator('#f-gate-name').fill('Test User');
  await page.locator('#f-gate-email').fill('test@example.com');
  const h2 = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/\s*→$/, '') === 'See my plan'));
  await h2.asElement().click();
}
await page.waitForSelector('.planin .metrics');
await dump('PLAN');
const h3 = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/\s*→$/, '') === 'Save plan'));
const el = h3.asElement();
if (!el) { console.log('NO SAVE BUTTON'); } else {
  await el.click();
  await new Promise(r => setTimeout(r, 1200));
  await dump('AFTER-SAVE');
  console.log('saved state', JSON.stringify(await page.evaluate(() => {
    const b = document.querySelector('.secondary .saved');
    const sb = document.querySelectorAll('.secondary button')[0];
    return { savedEl: !!b, firstBtnClass: sb ? sb.className : null, firstBtnText: sb ? sb.textContent.trim() : null, toast: !!document.querySelector('.toast'), plansStored: (localStorage.getItem('compass-plans') || '').length };
  })));
}
await browser.close();
server.kill();
