import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

async function clickButton(page, label) {
  // The mobile toast temporarily overlays navigation; wait for it to clear.
  await page.waitForSelector('.toast', { hidden: true });
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

test('example walkthrough generates automatically and respects interruptions', { timeout: 60000 }, async () => {
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
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(previewUrl+'?demo=1');
    await clickButton(page, 'Fill it in for me');
    await page.waitForSelector('.demohint');
    assert.match(await page.$eval('.demohint', e => e.textContent), /Example filled/);
    await page.waitForSelector('.planin .metrics');
    assert.ok(await page.$('.secondary'));
    // Replacing work still requires confirmation; cancelling does not run.
    await clickButton(page, 'Try another example');
    await page.waitForSelector('[role="alertdialog"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="alertdialog"]', { hidden: true });
    assert.ok(await page.$('.planin .metrics'));
    // Editing during the fill beat cancels automatic generation.
    await clickButton(page, 'Create another');
    // Dispatch the edit in the fill task, before the intentional 1s pause.
    // Remote click/type round trips can exceed that pause on a busy runner.
    await page.evaluate(async () => {
      [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Fill it in for me').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const e = document.querySelector('#f-name');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(e, 'My own draft');
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await delay(1300);
    assert.equal(await page.$('.planin .metrics'), null);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('h2')].some(e => e.textContent === 'Building your plan')), false);
    assert.equal(await page.$eval('#f-name', e => e.value), 'My own draft');
    // Opening a date field cancels the example before a date is committed.
    await page.reload();
    await clickButton(page, 'Fill it in for me');
    await page.waitForSelector('.demohint');
    await page.focus('input[type=date]');
    await delay(1300);
    assert.equal(await page.$('.planin .metrics'), null);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('h2')].some(e => e.textContent === 'Building your plan')), false);
    // Replacement confirmation during the fill pause must stop that pause.
    await page.reload();
    await clickButton(page, 'Fill it in for me');
    await page.waitForSelector('.demohint');
    await clickButton(page, 'Try another example');
    await page.waitForSelector('[role="alertdialog"]');
    await delay(1300);
    assert.equal(await page.$('.planin .metrics'), null);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('h2')].some(e => e.textContent === 'Building your plan')), false);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="alertdialog"]', {hidden:true});
    // A confirmed replacement runs again, with reduced motion too.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await clickButton(page, 'Try another example');
    await page.waitForSelector('[role="alertdialog"]');
    await page.locator('.confirm .btn').click();
    await page.waitForSelector('.planin .metrics');
    await clickButton(page, 'Create another');
    await clickButton(page, 'Fill it in for me');
    await clickButton(page, 'My plans');
    await page.waitForSelector('[role="alertdialog"]');
    await delay(1300);
    assert.equal(await page.$('.planin .metrics'), null);
    await clickButton(page, 'Discard changes');
    await page.waitForSelector('.plancard');
    await clickButton(page, 'Planner');
    await delay(1300);
    assert.equal(await page.$('.planin .metrics'), null);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('h2')].some(e => e.textContent === 'Building your plan')), false);
  } finally { await browser?.close(); server.kill(); }
});
