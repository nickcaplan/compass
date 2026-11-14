import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
const url = await new Promise((res, rej) => { let o=''; const t=setTimeout(()=>rej(new Error('t')),15000); server.stdout.on('data', d=>{ o+=stripVTControlCharacters(d.toString()); const m=o.match(/http:\/\/127\.0\.0\.1:\d+\//); if(m){clearTimeout(t);res(m[0]);} }); });
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
async function shot(name, { width, theme='dark', state='empty', text200=false }) {
  const p = await b.newPage();
  await p.setViewport({ width, height: 950 });
  await p.evaluateOnNewDocument(t => localStorage.setItem('compass-theme', t), theme);
  await p.goto(url + 'data-review', { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  if (state !== 'empty') {
    await p.click('#market'); await p.waitForSelector('.ir-dd-list'); await p.click('#market-opt-0');
    await p.click('#objective'); await p.waitForSelector('.ir-dd-list'); await p.click('#objective-opt-0');
    if (state === 'open') { await p.click('#objective'); await p.waitForSelector('.ir-dd-list'); }
  }
  if (text200) await p.evaluate(() => { for (const e of document.querySelectorAll('*')) { const s = parseFloat(getComputedStyle(e).fontSize); e.style.fontSize = s * 2 + 'px'; } });
  await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: state === 'selected' && !text200 });
  const info = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth }));
  console.log(name, JSON.stringify(info));
  await p.close();
}
await shot('dd-empty-dark-1440', { width: 1440 });
await shot('dd-empty-dark-390', { width: 390 });
await shot('dd-open-dark-1440', { width: 1440, state: 'open' });
await shot('dd-open-dark-390', { width: 390, state: 'open' });
await shot('dd-selected-dark-1440', { width: 1440, state: 'selected' });
await shot('dd-selected-dark-390', { width: 390, state: 'selected' });
await shot('dd-open-light-1440', { width: 1440, theme: 'light', state: 'open' });
await shot('dd-selected-light-1440', { width: 1440, theme: 'light', state: 'selected' });
await shot('dd-empty-dark-1440-t200', { width: 1440, text200: true });
await shot('dd-empty-dark-390-t200', { width: 390, text200: true });
await b.close(); server.kill(); console.log('DONE');
