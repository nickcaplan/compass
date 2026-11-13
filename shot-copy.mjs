import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { seedPlannerFixture } from '/home/sandbox/compass-copy/tests/planner-auth-fixture.mjs';

const outDir = process.argv[2];           // e.g. /home/sandbox/copy-before
const base = process.argv[3];             // live URL or 'local'
fs.mkdirSync(outDir, { recursive: true });

let url = base, server = null;
if (base === 'local') {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { cwd: '/home/sandbox/compass-copy', stdio: ['ignore', 'pipe', 'pipe'] });
  url = await new Promise((resolve, reject) => {
    let out = ''; const t = setTimeout(() => reject(new Error('preview timeout')), 15000);
    server.once('error', reject);
    server.stdout.on('data', d => { out += stripVTControlCharacters(d.toString()); const m = out.match(/http:\/\/127\.0\.0\.1:\d+\//); if (m) { clearTimeout(t); resolve(m[0]); } });
  });
}
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });

async function shot(name, { width, theme = 'dark', signedIn = false, route = '', text200 = false, tip = false }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  try {
    if (signedIn) await seedPlannerFixture(page);
    await page.setViewport({ width, height: 950 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(t => localStorage.setItem('compass-theme', t), theme);
    await page.goto(url + route, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    if (tip) { if (!(await page.$('.ir-stat-help button'))) { console.log(name, 'SKIP-no-tip'); return; } await page.click('.ir-stat-help button'); await new Promise(r => setTimeout(r, 350)); }
    if (text200) await page.evaluate(() => { for (const e of document.querySelectorAll('*')) { const s = parseFloat(getComputedStyle(e).fontSize); e.style.fontSize = s * 2 + 'px'; } });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: !text200 });
    const info = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, stats: [...document.querySelectorAll('.ir-stats strong')].map(e => e.textContent) }));
    console.log(name, JSON.stringify(info));
  } finally { await ctx.close(); }
}

// data review
for (const w of [390, 768, 1280, 1440, 1920]) await shot(`dr-dark-${w}`, { width: w, route: 'data-review' });
await shot('dr-light-1440', { width: 1440, theme: 'light', route: 'data-review' });
await shot('dr-light-390', { width: 390, theme: 'light', route: 'data-review' });
await shot('dr-dark-1440-tip', { width: 1440, route: 'data-review', tip: true });
await shot('dr-dark-390-tip', { width: 390, route: 'data-review', tip: true });
await shot('dr-dark-1440-t200', { width: 1440, route: 'data-review', text200: true });
await shot('dr-dark-390-t200', { width: 390, route: 'data-review', text200: true });
// planner home signed out (footer + saved-and-shareable line)
await shot('home-out-dark-1440', { width: 1440, route: '#/' });
await shot('home-out-dark-390', { width: 390, route: '#/' });
// my plans signed in
await shot('plans-in-dark-1440', { width: 1440, signedIn: true, route: '#/plans' });
await browser.close();
if (server) server.kill();
console.log('DONE');
