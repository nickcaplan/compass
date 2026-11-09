import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.env.CHROME_PATH ?? (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');

const robotoFixtureCss = [400, 500, 700].map((weight) => `@font-face{font-family:Roboto;font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(new URL(`./fixtures/roboto/Roboto-${weight}.ttf`, import.meta.url)).toString('base64')}) format('truetype')}`).join('');

// Pin text metrics to the Roboto fixture (same pattern as the audience-room
// test): network font fetches are aborted so every runner lays out
// identically. Without this the save geometry depends on installed fonts.
async function newTestPage(browser, viewport, previewUrl) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') void request.abort();
    else void request.continue();
  });
  await page.goto(`${previewUrl}?demo=1`, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: robotoFixtureCss });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

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
        const page = await newTestPage(browser, vp, previewUrl);
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

    // Spacer cleanup, synthetic and labelled as such: on current main
    // geometry (compact single-row form), measurement shows content below
    // the save row grows ~48px on save (Roboto fixture fonts), so no
    // scroll position at any viewport bottom-clamps on save and the spacer
    // never triggers through a real save. The no-jump claim for real saves
    // is covered by the sweep above. The spacer's lifecycle is therefore
    // exercised by simulating the clamped state's spacer directly and
    // verifying a real Edit plan click clears it - geometry coverage, not
    // a user-reachable save state.
    {
      const page = await newTestPage(browser, { width: 1280, height: 800 }, previewUrl);
      await clickButton(page, 'Fill it in for me');
      await page.waitForSelector('.planin .metrics', { timeout: 20000 });
      await page.evaluate(() => document.querySelector('.secondary').scrollIntoView({ block: 'center' }));
      await clickButton(page, 'Save plan');
      await page.waitForSelector('.ghost.saved', { timeout: 10000 });
      const organic = await page.evaluate(() => parseFloat(document.querySelector('.savespacer').style.height) || 0);
      assert.equal(organic, 0, `unexpected save slack on current geometry: ${organic}px (layout changed - re-check whether a real clamped state exists again)`);
      await page.evaluate(() => { document.querySelector('.savespacer').style.height = '120px'; });
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

