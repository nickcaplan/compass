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

test('saving a plan keeps the save row steady in the viewport', { timeout: 120000 }, async () => {
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

    // Leaving the saved state must clear the temporary bottom slack, and
    // the clamped state itself must be one a real visitor can reach: the
    // Save control fully inside the viewport and a real pointer click (no
    // synthetic dispatch, no scroll-into-view). The brief is filled through
    // the form controls with fixed values, and the clamp scroll position is
    // derived from heights measured in this run, so font-metric differences
    // across runners cannot silently remove the slack again.
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${previewUrl}?demo=1`, { waitUntil: 'networkidle0' });
      await clickButton(page, 'Awareness');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Reach'));
      await clickButton(page, 'Reach');
      await clickButton(page, 'North America');
      await clickButton(page, 'Procurement');
      await clickButton(page, 'Technician / Practitioner');
      await page.evaluate(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const put = (selector, value) => {
          const input = document.querySelector(selector);
          setter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const day = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
        put('#f-budget', '50000');
        put('[aria-label="Start date"]', day(7));
        put('[aria-label="End date"]', day(35));
      });
      await page.waitForFunction(() => { const g = document.querySelector('.gen'); return g && !g.disabled; });
      await clickButton(page, 'Generate my plan');
      await page.waitForSelector('.planin .metrics', { timeout: 20000 });

      const measure = () => page.evaluate(() => {
        const save = [...document.querySelectorAll('button')].find((x) => ['Save plan', 'Save changes'].includes(x.textContent.trim().replace(/\s*→$/, '')) && !x.disabled);
        const rect = save.getBoundingClientRect();
        const row = document.querySelector('.secondary').getBoundingClientRect();
        const doc = document.documentElement;
        return {
          btnTop: rect.top + window.scrollY, btnBottom: rect.bottom + window.scrollY,
          rowTop: row.top + window.scrollY, docH: doc.scrollHeight,
          innerH: window.innerHeight, maxScroll: doc.scrollHeight - window.innerHeight,
        };
      });
      const fullyVisible = () => page.evaluate(() => {
        const save = [...document.querySelectorAll('button')].find((x) => ['Save plan', 'Save changes'].includes(x.textContent.trim().replace(/\s*→$/, '')) && !x.disabled);
        const rect = save.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      const spacer = () => page.evaluate(() => parseFloat(document.querySelector('.savespacer').style.height) || 0);

      // Calibration save with the button at the bottom edge of the viewport
      // (always fully visible): measures how far the row moves up when the
      // form collapses, and the scrollable height after the swap.
      const m1 = await measure();
      await page.evaluate((y) => window.scrollTo(0, y), Math.min(m1.maxScroll, Math.max(0, m1.btnBottom - m1.innerH)));
      await new Promise((r) => setTimeout(r, 250));
      assert.ok(await fullyVisible(), 'calibration: Save plan not fully visible');
      await clickButton(page, 'Save plan');
      await page.waitForSelector('.ghost.saved', { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 300));
      const afterCal = await page.evaluate(() => {
        const row = document.querySelector('.secondary').getBoundingClientRect();
        const pad = parseFloat(document.querySelector('.savespacer').style.height) || 0;
        return { rowDocTop: row.top + window.scrollY, docH: document.documentElement.scrollHeight - pad };
      });
      await clickButton(page, 'Edit plan');
      await page.waitForSelector('input', { timeout: 10000 });
      assert.equal(await spacer(), 0, 'save spacer not cleared after Edit plan (calibration save)');
      await clickButton(page, 'Regenerate my plan');
      await page.waitForSelector('.planin .metrics', { timeout: 20000 });

      // slack(s) = s - K, with K = shrink above the row + maxScroll after
      // the swap (measured above). Pick s so the expected slack is ~80px and
      // the button stays fully visible; fail loudly with the geometry if
      // this build has no visible clamping state for the fixed brief.
      const shrinkAbove = m1.rowTop - afterCal.rowDocTop;
      const k = shrinkAbove + (afterCal.docH - m1.innerH);
      const m2 = await measure();
      const target = Math.min(m2.maxScroll, k + 80);
      assert.ok(target >= m2.btnBottom - m2.innerH && target <= m2.btnTop && target > k,
        `no visible clamping scroll position (K=${Math.round(k)}, target=${Math.round(target)}, geometry=${JSON.stringify(m2)})`);
      await page.evaluate((y) => window.scrollTo(0, y), target);
      await new Promise((r) => setTimeout(r, 250));
      assert.ok(await fullyVisible(), 'clamping state: Save plan not fully visible');
      const beforeRow = await page.evaluate(() => Math.round(document.querySelector('.secondary').getBoundingClientRect().top));
      {
        const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((x) => ['Save plan', 'Save changes'].includes(x.textContent.trim().replace(/\s*→$/, '')) && !x.disabled));
        try {
          const button = handle.asElement();
          assert.ok(button, 'Save control not found in the clamped state');
          await button.click();
        } finally {
          await handle.dispose();
        }
      }
      await page.waitForSelector('.ghost.saved', { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 300));
      const slack = await spacer();
      assert.ok(slack > 0, `expected temporary slack in the clamped state, got ${slack}px (K=${Math.round(k)})`);
      const afterRow = await page.evaluate(() => Math.round(document.querySelector('.secondary').getBoundingClientRect().top));
      assert.ok(Math.abs(afterRow - beforeRow) <= 8, `save row moved ${Math.abs(afterRow - beforeRow)}px in the clamped state`);
      await clickButton(page, 'Edit plan');
      await page.waitForSelector('input', { timeout: 10000 });
      assert.equal(await spacer(), 0, 'save spacer not cleared after Edit plan (clamped save)');
      await page.close();
    }
  } finally {
    browser?.close();
    server.kill();
  }
});
