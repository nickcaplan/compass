import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

test('nav is Planner, My plans and Sign in, with no Support link', { timeout: 60000 }, async () => {
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
      await page.goto(previewUrl);
      await page.waitForSelector('.navlinks');
      assert.deepEqual(
        await page.$$eval('.navlinks > button', bs => bs.map(b => b.textContent.trim()).filter(t => t.length > 0)),
        ['Planner', 'My plans', 'Sign in'],
      );
      assert.equal(await page.$eval('nav', n => n.textContent.includes('Support')), false, 'Support must stay out of the nav');
      assert.equal(await page.$eval('.navlinks .themebtn', b => b.getAttribute('aria-label')), 'Switch to light mode');
      assert.equal(await page.$eval('.prodhome', b => b.textContent.trim()), 'COMPASS');
      assert.equal(await page.evaluate(() => document.title), 'Compass - Plan a campaign');
      assert.ok(await page.$eval('#f-name', e => e.scrollWidth <= e.clientWidth), 'campaign name placeholder must not clip');
      const disabledGenerate = await page.$eval('.gen', e => { const s = getComputedStyle(e); return { opacity: s.opacity, cursor: s.cursor, border: s.borderTopWidth, shadow: s.boxShadow }; });
      assert.equal(disabledGenerate.opacity, '1');
      assert.equal(disabledGenerate.cursor, 'not-allowed');
      assert.equal(disabledGenerate.border, '1px');
      assert.equal(disabledGenerate.shadow, 'none');
      if (width >= 980) {
        // Nick (13 Nov 2026): nav options sit on the right of the header, not beside the brand.
        const brandRight = await page.$eval('.brand.lockup', e => e.getBoundingClientRect().right);
        const plannerLeft = await page.$eval('.navlinks > button:first-child', e => e.getBoundingClientRect().left);
        const signinRight = await page.$eval('.navlinks .signin', e => e.getBoundingClientRect().right);
        const headerRight = await page.$eval('.toprow', e => e.getBoundingClientRect().right);
        assert.ok(plannerLeft - brandRight > 200, `nav options must be detached from the brand (gap ${plannerLeft - brandRight}px)`);
        assert.ok(Math.abs(signinRight - headerRight) < 1, 'nav cluster must be flush with the right edge of the header');
      }
      await page.locator('.navlinks > button:nth-child(2)').click();
      await page.waitForSelector('.pagecard[aria-label="My plans"]');
      assert.equal(await page.evaluate(() => document.title), 'Compass - My plans');
      await page.locator('.navlinks .signin').click();
      await page.waitForSelector('.signincard');
      assert.equal(await page.evaluate(() => document.title), 'Compass - Sign in');
      await page.close();
    }
    const light = await browser.newPage();
    await light.setViewport({ width: 1440, height: 900 });
    await light.evaluateOnNewDocument(() => localStorage.setItem('compass-theme', 'light'));
    await light.goto(previewUrl);
    await light.waitForSelector('.industry-eyebrow');
    const eyebrow = await light.evaluate(() => {
      const label = document.querySelector('.industry-eyebrow > span[aria-hidden="true"]:not(.industry-reel)').getBoundingClientRect();
      const reel = document.querySelector('.industry-reel').getBoundingClientRect();
      return { top: Math.abs(label.top - reel.top), height: Math.abs(label.height - reel.height) };
    });
    assert.ok(eyebrow.top <= 1, 'light-mode eyebrow pair starts on the same line');
    assert.ok(eyebrow.height <= 1, 'light-mode eyebrow pair has the same line box');
    assert.ok(await light.$eval('#f-name', e => e.scrollWidth <= e.clientWidth), 'light-mode campaign name placeholder must not clip');
    await light.close();
    const pricing = await browser.newPage();
    await pricing.goto(previewUrl + '#/pricing');
    await pricing.waitForSelector('.pagecard[aria-label="Pricing"]');
    assert.equal(await pricing.evaluate(() => document.title), 'Compass - Pricing');
    await pricing.close();
  } finally { await browser?.close(); server.kill(); }
});
