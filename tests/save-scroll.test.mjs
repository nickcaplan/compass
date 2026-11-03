import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.env.CHROME_PATH ?? (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');

async function clickButton(page, label) {
  const handle = await page.evaluateHandle((text) =>
    [...document.querySelectorAll('button')].find((button) => button.textContent.trim().replace(/\s*→$/, '') === text), label);
  try {
    const button = handle.asElement();
    assert.ok(button, `Button not found: ${label}`);
    await button.click();
  } finally {
    await handle.dispose();
  }
}

test('saving a plan keeps the save row steady in the viewport', { timeout: 60000 }, async () => {
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', '4173', '--strictPort',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline && server.exitCode === null) {
      try {
        const response = await fetch('http://127.0.0.1:4173', { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) { ready = true; break; }
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.ok(ready, 'vite preview did not start');
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
    // Save swaps the tall form for a compact brief, shortening the page.
    // Wherever the visitor scrolled to, the row they tapped must stay put.
    // The exception is a page that becomes shorter than the viewport can
    // scroll: the browser clamps the scroll position, so only a reduced
    // movement is asserted there.
    for (const vp of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
      for (const frac of [0.2, 0.5, 0.8]) {
        const page = await browser.newPage();
        await page.setViewport(vp);
        await page.goto('http://127.0.0.1:4173/?demo=1', { waitUntil: 'networkidle0' });
        await clickButton(page, 'Fill it in for me');
        await page.waitForSelector('.planin', { timeout: 20000 });
        await page.evaluate((f) => {
          const el = document.querySelector('.secondary');
          window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * f));
        }, frac);
        await new Promise((r) => setTimeout(r, 250));
        const before = await page.evaluate(() => Math.round(document.querySelector('.secondary').getBoundingClientRect().top));
        await clickButton(page, 'Save plan');
        await new Promise((r) => setTimeout(r, 400));
        const after = await page.evaluate(() => Math.round(document.querySelector('.secondary').getBoundingClientRect().top));
        const shift = Math.abs(after - before);
        assert.ok(shift <= 60, `${vp.name} at ${Math.round(frac * 100)}% viewport: save row moved ${shift}px (was up to 330px without the pin)`);
        assert.ok(await page.$('.ghost.saved'), 'Saved state button shown');
        await page.close();
      }
    }
  } finally {
    browser?.close();
    server.kill();
  }
});
