import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { stdio: 'pipe' });
server.stderr.on('data', d => console.log('SRVERR', String(d).slice(0, 120)));
process.on('exit', () => server.kill());
const deadline = Date.now() + 10000;
while (Date.now() < deadline) {
  try { const r = await fetch('http://127.0.0.1:4180'); await r.body?.cancel(); if (r.ok) break; } catch {}
  await new Promise(r => setTimeout(r, 100));
}
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
await page.setViewport({ width: 412, height: 900 });
await page.goto('http://127.0.0.1:4180', { waitUntil: 'networkidle0' });
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
const info = await page.evaluate(() => {
  const b = document.querySelector('.secondary .saved');
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && rule.selectorText.includes('saved')) rules.push(rule.cssText.slice(0, 100));
      }
    } catch (e) { rules.push('SHEET-ERR'); }
  }
  return { cls: b.className, bundle: [...document.querySelectorAll('script[src]')].map(s => s.src.split('/').pop())[0], css: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href.split('/').pop()), savedRules: rules, pe: getComputedStyle(b).pointerEvents };
});
console.log(JSON.stringify(info, null, 1));
await page.mouse.move(5, 5);
await new Promise(r => setTimeout(r, 500));
console.log('rest:', JSON.stringify(await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.secondary .saved')); return { hover: document.querySelector('.secondary .saved').matches(':hover'), ink: cs.color, border: cs.borderColor }; })));
const rect = await page.evaluate(() => { const r = document.querySelector('.secondary .saved').getBoundingClientRect(); return { x: Math.max(2, r.x + r.width / 2), y: Math.max(2, r.y + r.height / 2) }; });
await page.mouse.move(rect.x, rect.y);
await new Promise(r => setTimeout(r, 500));
console.log('hovered:', JSON.stringify(await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.secondary .saved')); return { hover: document.querySelector('.secondary .saved').matches(':hover'), ink: cs.color, border: cs.borderColor }; })));
await browser.close();
server.kill();
