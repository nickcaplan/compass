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
const results = {};

async function clickButton(page, label) {
  const handle = await page.evaluateHandle((text) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/\s*→$/, '') === text), label);
  const btn = handle.asElement();
  if (!btn) throw new Error('Button not found: ' + label);
  await btn.click();
  await handle.dispose();
}

for (const [width, theme, shot] of [[412, 'dark', '/downloads/pr17-412-dark.png'], [412, 'light', '/downloads/pr17-412-light.png'], [1280, 'dark', '/downloads/pr17-1280-dark.png'], [1280, 'light', '/downloads/pr17-1280-light.png']]) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  await page.setViewport({ width, height: 900 });
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle0' });
  await page.evaluate((t) => localStorage.setItem('compass-theme', t), theme);
  await page.reload({ waitUntil: 'networkidle0' });
  await clickButton(page, 'Fill it in for me');
  await page.waitForFunction(() => !document.querySelector('.gen').disabled);
  await page.locator('.gen').click();
  await page.waitForSelector('.planin');
  if (await page.$('#f-gate-name')) {
    await page.locator('#f-gate-name').fill('Test User');
    await page.locator('#f-gate-email').fill('test@example.com');
    await clickButton(page, 'See my plan');
  }
  await page.waitForSelector('.planin .metrics');
  await clickButton(page, 'Save plan');
  await page.waitForFunction(() => { const b = document.querySelector('.secondary .saved'); return b && b.disabled; });
  const state = await page.evaluate(() => {
    const b = document.querySelector('.secondary .saved');
    const cs = getComputedStyle(b);
    return { label: b.textContent.trim(), disabled: b.disabled, ink: cs.color, border: cs.borderColor, toast: !!document.querySelector('.toast') };
  });
  await page.evaluate(() => document.querySelector('.secondary').scrollIntoView({ block: 'center' }));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: shot });
  results[`${width}-${theme}`] = state;
  await ctx.close();
}
await browser.close();
server.kill();
console.log(JSON.stringify(results, null, 1));
