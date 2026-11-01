import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => server.kill());
const deadline = Date.now() + 10000;
while (Date.now() < deadline) {
  try { const r = await fetch('http://127.0.0.1:4174'); await r.body?.cancel(); if (r.ok) break; } catch {}
  await new Promise(r => setTimeout(r, 100));
}
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.setViewport({ width: 412, height: 900 });
await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.setItem('compass-theme', 'dark'));
await page.reload({ waitUntil: 'networkidle0' });
const click = async (label) => {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/\s*→$/, '') === t), label);
  await h.asElement().click();
};
await click('Fill it in for me');
await page.waitForFunction(() => !document.querySelector('.gen').disabled);
await page.locator('.gen').click();
await page.waitForSelector('.planin');
if (await page.$('#f-gate-name')) {
  await page.locator('#f-gate-name').fill('Test User');
  await page.locator('#f-gate-email').fill('test@example.com');
  await click('See my plan');
}
await page.waitForSelector('.planin .metrics');
await click('Save plan');
await page.waitForFunction(() => { const b = document.querySelector('.secondary .saved'); return b && b.disabled; });
const rect = await page.evaluate(() => { const r = document.querySelector('.secondary .saved').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.mouse.move(5, 5);
await new Promise(r => setTimeout(r, 200));
await page.mouse.move(rect.x, rect.y);
await new Promise(r => setTimeout(r, 400));
console.log('deliberate hover:', JSON.stringify(await page.evaluate(() => {
  const b = document.querySelector('.secondary .saved');
  const cs = getComputedStyle(b);
  const rules = [];
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.selectorText && rule.selectorText.includes('saved')) rules.push(rule.cssText.slice(0, 90));
    }
  }
  return { hover: b.matches(':hover'), ink: cs.color, border: cs.borderColor, savedRules: rules };
})));
await browser.close();
server.kill();
