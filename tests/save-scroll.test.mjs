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
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  let browser;
  try {
    // Use only the URL announced by this child, never an unrelated process.
    const previewUrl = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Preview server did not become ready')), 10000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Preview exited early: ${code}`)); });
      server.stdout.on('data', (chunk) => {
        output += chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      });
    });
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
        await page.goto(`${previewUrl}?demo=1`, { waitUntil: 'networkidle0' });
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

    // Leaving the saved state must clear the temporary bottom slack. Only a
    // filled page tall enough to bottom-clamp after the save swap creates
    // slack, and the demo picker is random, so re-pick (each pick excludes
    // the current example) until a known clamping variant appears. Stubbing
    // Math.random would also freeze plan generation and change the page
    // height, defeating the setup.
    {
      const clamping = ['UK Laboratory Procurement Campaign', 'European R&D Awareness Drive'];
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${previewUrl}?demo=1`, { waitUntil: 'networkidle0' });
      const nameOf = () => page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.value)[0] || '');
      await clickButton(page, 'Fill it in for me');
      await page.waitForSelector('.planin', { timeout: 20000 });
      let name = await nameOf();
      for (let attempt = 0; attempt < 12 && !clamping.includes(name); attempt++) {
        await clickButton(page, 'Try another example');
        await page.waitForSelector('[role=alertdialog]', { timeout: 5000 });
        await clickButton(page, 'Replace with example');
        await page.waitForFunction((prev) => ([...document.querySelectorAll('input')].map((i) => i.value)[0] || '') !== prev, { timeout: 20000 }, name);
        await page.waitForSelector('.planin', { timeout: 20000 });
        name = await nameOf();
      }
      assert.ok(clamping.includes(name), `no clamping demo variant after 12 picks (last: ${name})`);
      await page.evaluate(() => {
        const el = document.querySelector('.secondary');
        window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5));
      });
      await new Promise((r) => setTimeout(r, 250));
      await clickButton(page, 'Save plan');
      await new Promise((r) => setTimeout(r, 400));
      const slack = await page.evaluate(() => parseFloat(document.querySelector('.savespacer').style.height) || 0);
      assert.ok(slack > 0, `expected temporary slack after saving the clamping variant, got ${slack}px`);
      await clickButton(page, 'Edit plan');
      await page.waitForSelector('input', { timeout: 10000 });
      const left = await page.evaluate(() => parseFloat(document.querySelector('.savespacer').style.height) || 0);
      assert.equal(left, 0, `save spacer still ${left}px after Edit plan`);
      await page.close();
    }
  } finally {
    browser?.close();
    server.kill();
  }
});
