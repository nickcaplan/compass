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
  await page.waitForFunction(() => !document.querySelector('.gen').disabled);
  await page.locator('.gen').click();
  await page.waitForSelector('.planin .metrics');
}

// Plants a stored Supabase session so the app loads as signed in, the way it
// would after a real OAuth or magic-link round trip. supabase-js accepts an
// unexpired stored session without a network call, so this needs no live
// Supabase project or credentials.
async function signInTestUser(page) {
  await page.evaluateOnNewDocument(() => {
    const session = {
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'test-refresh-token',
      user: {
        id: 'test-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      },
    };
    window.localStorage.setItem('sb-ctailpmcoyvaplwbwskf-auth-token', JSON.stringify(session));
  });
}

test('saved-plan replacement protects unsaved answers', { timeout: 60000 }, async (t) => {
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', '4173', '--strictPort',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  let serverOutput = '';
  let serverErrors = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverErrors += chunk.toString(); });
  server.on('error', (error) => { serverErrors += error.message; });
  try {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline && server.exitCode === null) {
      try {
        const response = await fetch('http://127.0.0.1:4173', { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Retry only while the preview is starting, within the deadline.
      }
      await delay(100);
    }
    assert.ok(ready, `Preview did not become ready: ${serverOutput}\n${serverErrors}`);
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:4173');

    // Anonymous first generation is gated behind real sign-in: the gate shows
    // the sign-in options and keeps the plan hidden.
    await clickButton(page, 'Fill it in for me');
    await page.waitForFunction(() => !document.querySelector('.gen').disabled);
    await page.locator('.gen').click();
    await page.waitForSelector('.planin');
    assert.ok(await page.$('#f-gate-email'), 'First generation must show the sign-in gate');
    assert.ok(await page.$('.sso'), 'Gate must offer Continue with Google');
    assert.equal(await page.$('.planin .metrics'), null, 'Plan stays behind the gate');

    // With a signed-in session, generation goes straight to the plan.
    await signInTestUser(page);
    await page.reload();
    // The header reflects the signed-in account instead of a Sign in prompt.
    await page.waitForFunction(() => document.querySelector('.signin')?.textContent?.trim() === 'test@example.com');
    await generateExample(page);
    const originalName = await page.$eval('#f-name', (input) => input.value);
    await clickButton(page, 'Save plan');
    await page.waitForFunction(() => document.querySelector('.toast')?.textContent === 'Saved to My plans');

    await t.test('saved new plan still warns after its form is edited', async () => {
      await page.locator('#f-name').fill('Unsaved campaign name');
      await page.waitForFunction(() => document.querySelector('.secondary .btn').disabled);
      await openSavedPlan(page);
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', (dialog) => dialog.textContent), /Discard unsaved changes/);
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', (input) => input.value), 'Unsaved campaign name');

      await openSavedPlan(page);
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .btn').click();
      await page.waitForSelector('.bsum');
      assert.equal(await page.$eval('.bsum .v', (value) => value.textContent), originalName);
      assert.equal(await page.$('[role="alertdialog"]'), null);
    });

    await t.test('reopening an unchanged saved view needs no confirmation', async () => {
      await openSavedPlan(page);
      await page.waitForSelector('.bsum');
      assert.equal(await page.$('[role="alertdialog"]'), null);
    });

    await t.test('saved-plan edit mode still warns and cancellation keeps edits', async () => {
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Edited saved plan');
      await openSavedPlan(page);
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', (input) => input.value), 'Edited saved plan');
      await clickButton(page, 'Cancel');
      await page.waitForSelector('.bsum');
    });

    await t.test('draft replacement warns and Escape preserves answers', async () => {
      await clickButton(page, 'Create another scenario');
      await page.locator('#f-name').fill('Unfinished draft');
      await openSavedPlan(page);
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', (dialog) => dialog.textContent), /Replace your draft/);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', (input) => input.value), 'Unfinished draft');
      await openSavedPlan(page);
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .btn').click();
      await page.waitForSelector('.bsum');
    });

    await t.test('an unsaved generated plan still requires confirmation', async () => {
      await clickButton(page, 'Create another scenario');
      await generateExample(page);
      await openSavedPlan(page);
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', (dialog) => dialog.textContent), /Replace your current plan/);
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
    });

    await t.test('long confirmation content stays inside a short viewport', async () => {
      await page.evaluate(() => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        plans[0].brief.name = 'Long campaign name '.repeat(100);
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      });
      await page.reload();
      await page.setViewport({ width: 412, height: 300 });
      await clickButton(page, 'My plans');
      await page.waitForSelector('.pc-actions');
      await clickButton(page, 'Delete');
      await page.waitForSelector('[role="alertdialog"]');
      const bounds = await page.$eval('.confirm', (dialog) => {
        const rect = dialog.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: window.innerHeight };
      });
      assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.height, 'Dialog must fit inside the viewport');
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluate((name) => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        plans[0].brief.name = name;
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      }, originalName);
      await page.reload();
    });

    await t.test('cancelling after another tab deletes the plan clears the saved view', async () => {
      await openSavedPlan(page);
      await page.waitForSelector('.bsum');
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Unsaved edit to deleted plan');
      const otherPage = await context.newPage();
      try {
        await otherPage.goto('http://127.0.0.1:4173');
        await clickButton(otherPage, 'My plans');
        await otherPage.waitForSelector('.pc-actions');
        await clickButton(otherPage, 'Delete');
        await otherPage.waitForSelector('[role="alertdialog"]');
        await otherPage.locator('.confirm .btn').click();
        await otherPage.waitForSelector('.plancard', { hidden: true });
      } finally {
        await otherPage.close();
      }
      await clickButton(page, 'Cancel');
      await page.waitForSelector('.bsum', { hidden: true });
      assert.equal(await page.$eval('#f-name', (input) => input.value), '');
      assert.match(await page.$eval('.toast', (toast) => toast.textContent), /no longer in My plans/);
      await clickButton(page, 'My plans');
      assert.equal(await page.$('.plancard'), null);
    });
  } finally {
    await browser?.close();
    server.kill();
  }
});
