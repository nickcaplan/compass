import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

test('planning cards stay readable and inputs remain usable', { timeout: 60000 }, async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  let browser;
  try {
    // Use only the URL announced by this child, never an unrelated process.
    const previewUrl = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Preview server did not become ready')), 10000);
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited early: ${code}`)); });
      server.stdout.on('data', chunk => {
        output += chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      });
    });
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      await page.goto(previewUrl+'?demo=1');
      await page.waitForSelector('.planning-step');
      assert.equal(await page.$$eval('.planning-step',es=>es.length),7);
      assert.equal(await page.$$eval('.planning-step',es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})),true);
      await page.locator('#f-name').fill('Readable planning cards');
      await page.$eval('[aria-labelledby=g-objective] button', e=>e.click());
      await page.waitForFunction(()=>[...document.querySelectorAll('.planning-step')].find(e=>e.querySelector('label')?.textContent==='KPI')?.querySelector('button'));
      assert.equal(await page.$eval('#f-name',e=>e.value),'Readable planning cards');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.$eval('.themebtn',e=>e.click());
      assert.equal(await page.$$eval('.planning-step',es=>es.every(e=>getComputedStyle(e).borderTopStyle==='solid')),true);
      await page.close();
    }
  } finally { await browser?.close(); server.kill(); }
});
