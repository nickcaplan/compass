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

async function openSavedPlan(page) {
  await clickButton(page, 'My plans');
  await page.waitForSelector('.pc-actions');
  await clickButton(page, 'Open plan');
}

async function generateExample(page) {
  await clickButton(page, 'Fill it in for me');

  await page.waitForSelector('.planin');
}

test('example walkthrough generates automatically and respects interruptions', { timeout: 60000 }, async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4185', '--strictPort'], { stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:4185')).ok) break; } catch {} await delay(100); }
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4185');
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
    await clickButton(page, 'Create another scenario');
    await clickButton(page, 'Fill it in for me');
    await page.locator('#f-name').fill('My own draft');
    await delay(1300);
    assert.equal(await page.$('.planin .metrics'), null);
    assert.equal(await page.$eval('#f-name', e => e.value), 'My own draft');
    // A confirmed replacement runs again, with reduced motion too.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await clickButton(page, 'Try another example');
    await page.waitForSelector('[role="alertdialog"]');
    await page.locator('.confirm .btn').click();
    await page.waitForSelector('.planin .metrics');
    await clickButton(page, 'Create another scenario');
    await clickButton(page, 'Fill it in for me');
    await clickButton(page, 'My plans');
    await delay(1300);
    await clickButton(page, 'Planner');
    assert.equal(await page.$('.planin .metrics'), null);
  } finally { await browser?.close(); server.kill(); }
});
