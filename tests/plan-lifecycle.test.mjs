import { installAuthFixture, fixtureNavigation } from './helpers/auth-fixtures.mjs';
import {observeJourney, reportJourneyFailure} from './fixtures/journey-diagnostics.mjs';
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
  // A fresh web font can move the button between targeting and dispatch.
  // Locator clicks keep the physical pointer path and wait for stable geometry.
  const findButton = new Function(
    `return [...document.querySelectorAll('button')].find(button => button.textContent.trim().replace(/\\s*→$/, '') === ${JSON.stringify(label)})`);
  await page.locator(findButton).click();
}

async function openSavedPlan(page) {
  await clickButton(page, 'My plans');
  await page.waitForSelector('.pc-actions');
  await clickButton(page, 'Open plan');
}

async function generateExample(page) {
  await clickButton(page, 'Fill it in for me');
  await page.waitForSelector('.planin .metrics', { timeout: 20000 });
  assert.equal(await page.$eval('.cta b', e => e.textContent), 'A Hybrid House specialist can pick it up from here.');
}

// Plants a stored Supabase session so the app loads as signed in, the way it
// would after a real OAuth or magic-link round trip. supabase-js accepts an
// unexpired stored session without a network call, so this needs no live
// Supabase project or credentials.
async function signInTestUser(page) {
  await installAuthFixture(page);
  await page.evaluateOnNewDocument(async () => {
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
        user_metadata: { full_name: 'Test User', compass_profile_complete: true },
        created_at: '2026-01-01T00:00:00Z',
      },
    };
    await window.fixtureAuth.setItem('sb-ctailpmcoyvaplwbwskf-auth-token', JSON.stringify(session));
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
    await observeJourney(page);await page.setViewport({ width: 1440, height: 900 });
    await installAuthFixture(page);await fixtureNavigation(page,'http://127.0.0.1:4173/?demo=1');
    // Initial router setup clears any pending walkthrough. Wait before clicking.
    await page.waitForFunction(() => location.hash === '#/planner');

    // Anonymous first generation is gated behind real sign-in: the gate shows
    // the sign-in options and keeps the plan hidden.
    await clickButton(page, 'Fill it in for me');
    // Fill starts generation automatically. Do not race it with a second click.
    await page.waitForSelector('#f-gate-email');
    assert.ok(await page.$('#f-gate-email'), 'First generation must show the sign-in gate');
    assert.ok(await page.$('.sso'), 'Gate must offer Continue with Google');
    assert.equal(await page.$('.planin .metrics'), null, 'Plan stays behind the gate');

    // With a signed-in session, generation goes straight to the plan.
    await signInTestUser(page);
    await page.reload();
    // The header reflects the signed-in account avatar instead of a Log in prompt.
    await page.waitForFunction(() => document.querySelector('.signin')?.getAttribute('aria-label')?.includes('test@example.com'));
    assert.equal(await page.$eval('.signin .avatar', (e) => e.textContent?.trim()), 'T');

    await generateExample(page);
    const originalName = await page.$eval('#f-name', (input) => input.value);
    await clickButton(page, 'Save plan');
    await page.waitForFunction(() => { const b = document.querySelector('.secondary .saved'); return b && b.disabled && b.textContent.trim() === 'Saved'; });
    await page.waitForSelector('.bsum');
    assert.equal(await page.$eval('.saved-page-head .saved-back', e => e.textContent), 'View all plans');

    await t.test('saved new plan still warns after its form is edited', async () => {
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Unsaved campaign name');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', (dialog) => dialog.textContent), /Discard unsaved changes/);
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', (input) => input.value), 'Unsaved campaign name');

      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .btn').click();
      await page.waitForSelector('.plancard');
      await clickButton(page, 'Open plan');
      await page.waitForSelector('.bsum');
      assert.equal(await page.$eval('.bsum .v', (value) => value.textContent), originalName);
      assert.equal(await page.$('[role="alertdialog"]'), null);
    });

    await t.test('reopening an unchanged saved view needs no confirmation', async () => {
      await openSavedPlan(page);
      await page.waitForSelector('.bsum');
      assert.equal(await page.$('[role="alertdialog"]'), null);
    });

    await t.test('saving an edited plan confirms with the Saved state', async () => {
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Saved spring rename');
      await page.locator('.gen').click();
      // Four950ms checklist ticks follow the1s walkthrough pause. Busy CI
  // must wait for completion rather than treating runner speed as app failure.
  await page.waitForSelector('.planin', { timeout: 20000 });
  assert.equal(await page.$eval('.cta b',e=>e.textContent), 'A Hybrid House specialist can pick it up from here.');
      await clickButton(page, 'Save changes');
      await page.waitForFunction(() => { const b = document.querySelector('.secondary .saved'); return b && b.disabled && b.textContent.trim() === 'Saved'; });
      await page.waitForSelector('.bsum');
      await delay(300);
      assert.equal(await page.$('.toast'), null);
      const savedName = await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.name);
      assert.equal(savedName, 'Saved spring rename');
    });

    await t.test('a campaign past its end date shows an Expired chip in My plans', async () => {
      const originalDates = await page.evaluate(() => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        const { start, end } = plans[0].brief;
        plans[0].brief.start = '2019-12-01';
        plans[0].brief.end = '2020-02-01';
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
        return { start, end };
      });
      await page.reload();
      await clickButton(page, 'My plans');
      await page.waitForSelector('.plancard');
      const firstChip = await page.$eval('.plancard .chip', (chip) => chip.textContent);
      assert.equal(firstChip, 'Expired');
      await page.evaluate(({ start, end }) => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        plans[0].brief.start = start;
        plans[0].brief.end = end;
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      }, originalDates);
      await page.reload();
      await clickButton(page, 'My plans');
      await page.waitForSelector('.plancard');
      const restoredChip = await page.$eval('.plancard .chip', (chip) => chip.textContent);
      assert.notEqual(restoredChip, 'Expired');
      await page.evaluate(() => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        const now = new Date();
        const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        plans[0].brief.start = iso;
        plans[0].brief.end = iso;
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      });
      await page.reload();
      await clickButton(page, 'My plans');
      await page.waitForSelector('.plancard');
      const todayChips = await page.$eval('.plancard', (card) =>
        [...card.querySelectorAll('.chips .chip')].map((chip) => chip.textContent));
      assert.equal(todayChips.includes('Expired'), false);
      await page.evaluate(({ start, end }) => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        plans[0].brief.start = start;
        plans[0].brief.end = end;
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      }, originalDates);
      await page.reload();
      await clickButton(page, 'My plans');
      await page.waitForSelector('.plancard');
      await clickButton(page, 'Open plan');
      await page.waitForSelector('.bsum');
    });

    await t.test('saved-plan edit mode still warns and cancellation keeps edits', async () => {
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Edited saved plan');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', (input) => input.value), 'Edited saved plan');
      await clickButton(page, 'Cancel');
      await page.waitForSelector('.bsum');
    });

    await t.test('draft replacement warns and Escape preserves answers', async () => {
      await clickButton(page, 'Create another');
      await page.locator('#f-name').fill('Unfinished draft');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', (dialog) => dialog.textContent), /Replace your draft/);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', (input) => input.value), 'Unfinished draft');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .btn').click();
      await page.waitForSelector('.plancard');
      await clickButton(page, 'Open plan');
      await page.waitForSelector('.bsum');
    });

    await t.test('an unsaved generated plan still requires confirmation', async () => {
      await clickButton(page, 'Create another');
      await generateExample(page);
      await clickButton(page, 'My plans');
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
      await page.locator('.pc-delete').click();
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
      const savedName = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.name);
      await openSavedPlan(page);
      await page.waitForSelector('.bsum');
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Unsaved edit to deleted plan');
      const otherPage = await context.newPage();
      await observeJourney(otherPage);
      // A seed plan can share the saved plan's name (demoBrief picks at
      // random and two variants reuse seed names), so identity is a count:
      // user plans render before seeds, the first match is the saved plan,
      // and deleting it drops the matching-card count by exactly one.
      const cardsWithName = (scope) => scope.$$eval('.plancard', (cards, n) =>
        cards.filter((c) => c.textContent.includes(n)).length, savedName);
      let beforeCount = 0;
      try {
        await (await installAuthFixture(otherPage), fixtureNavigation(otherPage,'http://127.0.0.1:4173'));
        await clickButton(otherPage, 'My plans');
        await otherPage.waitForSelector('.pc-actions');
        beforeCount = await cardsWithName(otherPage);
        const deleteHandle = await otherPage.evaluateHandle((n) =>
          [...document.querySelectorAll('.plancard')].find((c) => c.textContent.includes(n))?.querySelector('button.pc-delete'), savedName);
        const deleteButton = deleteHandle.asElement();
        assert.ok(deleteButton, 'saved plan card not found');
        await deleteButton.click();
        await deleteHandle.dispose();
        await otherPage.waitForSelector('[role="alertdialog"]');
        await otherPage.locator('.confirm .btn').click();
        // Puppeteer treats waitForFunction's second parameter as options, so
        // the predicate arguments must follow an explicit options object.
        await otherPage.waitForFunction((n, before) =>
          [...document.querySelectorAll('.plancard')].filter((c) => c.textContent.includes(n)).length === before - 1,
          {}, savedName, beforeCount);
      } catch (error) { await reportJourneyFailure(browser); throw error; } finally {
        await otherPage.close();
      }
      await clickButton(page, 'Cancel');
      await page.waitForSelector('.bsum', { hidden: true });
      assert.equal(await page.$eval('#f-name', (input) => input.value), '');
      assert.match(await page.$eval('.toast', (toast) => toast.textContent), /no longer in My plans/);
      await clickButton(page, 'My plans');
      const remaining = await cardsWithName(page);
      assert.equal(remaining, beforeCount - 1);
    });
  } catch (error) { await reportJourneyFailure(browser); throw error; } finally {
    await browser?.close();
    server.kill();
  }
});

test('seeded demo plans appear for a fresh visitor, stay deleted, and never override user plans', { timeout: 90000 }, async () => {
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', '4175', '--strictPort',
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
        const response = await fetch('http://127.0.0.1:4175', { signal: AbortSignal.timeout(1000) });
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
    await observeJourney(page);await page.setViewport({ width: 1440, height: 900 });

    const cardNames = () => page.$$eval('.plancard b', (els) => els.map((e) => e.textContent));
    const expiredCount = () => page.$$eval('.chip', (els) => els.filter((e) => e.textContent.trim() === 'Expired').length);

    // Fresh visitor: exactly the seven seeds, five of them Expired.
    await (await installAuthFixture(page), fixtureNavigation(page,'http://127.0.0.1:4175/?demo=1'));
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    assert.equal((await cardNames()).length, 7);
    assert.equal(await expiredCount(), 5);
    await page.locator('.planfilters button:nth-child(2)').click();
    assert.equal((await cardNames()).length, 2);
    assert.equal(await expiredCount(), 0);
    assert.equal(await page.$eval('.planfilters button:nth-child(2)', (el) => el.getAttribute('aria-pressed')), 'true');
    await page.locator('.planfilters button:nth-child(3)').click();
    assert.equal((await cardNames()).length, 5);
    assert.equal(await expiredCount(), 5);
    await page.locator('.planfilters button:first-child').click();
    assert.equal((await cardNames()).length, 7);

    const seeded = await page.evaluate(() => ({
      plans: JSON.parse(localStorage.getItem('compass-saved-plans')),
      meta: JSON.parse(localStorage.getItem('compass-seeded-plans')),
    }));
    assert.deepEqual(seeded.plans.map((p) => p.id), ['seed-active-1', 'seed-active-2', 'seed-past-1', 'seed-past-2', 'seed-past-3', 'seed-past-4', 'seed-past-5']);
    assert.deepEqual([...seeded.meta.applied].sort(), ['seed-active-1', 'seed-active-2', 'seed-past-1', 'seed-past-2', 'seed-past-3', 'seed-past-4', 'seed-past-5']);
    for (const plan of seeded.plans) {
      assert.ok(plan.savedAt, 'seed has a savedAt');
    }

    // A reload neither duplicates nor reshuffles the seeds.
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    assert.equal((await cardNames()).length, 7);

    // The visitor's own plan lands first and is never overwritten by seeds.
    await signInTestUser(page);
    await (await installAuthFixture(page), fixtureNavigation(page,'http://127.0.0.1:4175/?demo=1'));
    await clickButton(page, 'Planner');
    await generateExample(page);
    const userName = await page.$eval('#f-name', (input) => input.value);
    await clickButton(page, 'Save plan');
    await page.waitForFunction(() => { const b = document.querySelector('.secondary .saved'); return b && b.disabled && b.textContent.trim() === 'Saved'; });
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    const names = await cardNames();
    assert.equal(names.length, 8);
    assert.ok(names[0].includes(userName), `user plan first: ${names[0]}`);

    // Deleting a seed sticks: it is not re-added on reload.
    const deleteHandle = await page.evaluateHandle(() =>
      [...document.querySelectorAll('.plancard')].find((c) => c.textContent.includes('Global Reagent Launch'))?.querySelector('button.pc-delete'));
    const deleteButton = deleteHandle.asElement();
    assert.ok(deleteButton, 'seed card delete button not found');
    await deleteButton.click();
    await deleteHandle.dispose();
    await page.waitForSelector('[role="alertdialog"]');
    await page.locator('.confirm .btn').click();
    await page.waitForSelector('[role="alertdialog"]', { hidden: true });
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    assert.equal((await cardNames()).length, 7);
    const afterDelete = await page.evaluate(() => ({
      plans: JSON.parse(localStorage.getItem('compass-saved-plans')),
      meta: JSON.parse(localStorage.getItem('compass-seeded-plans')),
    }));
    assert.ok(!afterDelete.plans.some((p) => p.id === 'seed-past-2'));
    assert.ok(afterDelete.meta.applied.includes('seed-past-2'), 'deleted seed stays in applied');
  } catch (error) { await reportJourneyFailure(browser); throw error; } finally {
    if (browser) await browser.close();
    server.kill();
  }
});

test('corrupt saved plans are moved aside with a notice and saving still works', { timeout: 60000 }, async () => {
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', '4174', '--strictPort',
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
        const response = await fetch('http://127.0.0.1:4174', { signal: AbortSignal.timeout(1000) });
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
    await observeJourney(page);await page.setViewport({ width: 1440, height: 900 });
    await installAuthFixture(page);await fixtureNavigation(page,'http://127.0.0.1:4174/?demo=1');

    // A clean visitor sees samples without a recovery notice.
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    assert.equal(await page.$('.notice'), null);

    // Corrupt the saved plans payload, then reload: the unreadable copy is
    // moved aside and the visitor is told instead of silently seeing empty.
    await page.evaluate(() => localStorage.setItem('compass-saved-plans', '{not json'));
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.notice');
    assert.match(await page.$eval('.notice', (n) => n.textContent), /could not be fully read on this device/);
    const stored = await page.evaluate(() => ({
      main: localStorage.getItem('compass-saved-plans'),
      backups: JSON.parse(localStorage.getItem('compass-saved-plans-corrupt')),
    }));
    assert.equal(stored.main, null);
    assert.equal(stored.backups.length, 1);
    assert.equal(stored.backups[0].payload, '{not json');

    // Dismissing the notice hides it, and a reload does not bring it back.
    await page.locator('.notice .ghost').click();
    await page.waitForSelector('.notice', { hidden: true });
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.empty');
    assert.equal(await page.$('.notice'), null);

    // Saving works normally afterwards, and the unreadable copy is kept.
    await signInTestUser(page);
    await (await installAuthFixture(page), fixtureNavigation(page,'http://127.0.0.1:4174/?demo=1'));
    await clickButton(page, 'Planner');
    await generateExample(page);
    await clickButton(page, 'Save plan');
    await page.waitForFunction(() => { const b = document.querySelector('.secondary .saved'); return b && b.disabled && b.textContent.trim() === 'Saved'; });
    const after = await page.evaluate(() => ({
      plans: JSON.parse(localStorage.getItem('compass-saved-plans')),
      backups: JSON.parse(localStorage.getItem('compass-saved-plans-corrupt')),
    }));
    assert.equal(after.plans.length, 1);
    assert.equal(after.backups.length, 1);
    assert.equal(after.backups[0].payload, '{not json');

    // A second, different unreadable payload is preserved alongside the first
    // backup, never silently discarded behind it.
    await page.evaluate(() => localStorage.setItem('compass-saved-plans', '["broken too"'));
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.notice');
    const twice = await page.evaluate(() => ({
      main: localStorage.getItem('compass-saved-plans'),
      backups: JSON.parse(localStorage.getItem('compass-saved-plans-corrupt')),
    }));
    assert.equal(twice.main, null);
    assert.equal(twice.backups.length, 2);
    assert.deepEqual(twice.backups.map((b) => b.payload), ['{not json', '["broken too"']);

    // When the backup write itself fails (quota/security), the original
    // payload is left untouched, no misleading empty list is shown, an
    // honest failure panel tells the visitor, and writes stay blocked.
    const blockedContext = await browser.createBrowserContext();
    const blocked = await blockedContext.newPage();
    blocked.setDefaultTimeout(10000);
    await blocked.evaluateOnNewDocument(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === 'compass-saved-plans-corrupt') throw new DOMException('quota', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await (await installAuthFixture(blocked), fixtureNavigation(blocked,'http://127.0.0.1:4174/?demo=1'));
    await blocked.evaluate(() => localStorage.setItem('compass-saved-plans', '{still here'));
    await blocked.reload();
    await clickButton(blocked, 'My plans');
    await blocked.waitForSelector('[role="alert"]');
    assert.match(await blocked.$eval('[role="alert"]', (n) => n.textContent), /could not be loaded safely/);
    assert.equal(await blocked.$('.empty'), null);
    assert.equal(await blocked.$('.plancard'), null);
    const kept = await blocked.evaluate(() => ({
      main: localStorage.getItem('compass-saved-plans'),
      backups: localStorage.getItem('compass-saved-plans-corrupt'),
    }));
    assert.equal(kept.main, '{still here');
    assert.equal(kept.backups, null);

    // Saving is blocked while the unreadable original cannot be backed up.
    await signInTestUser(blocked);
    await (await installAuthFixture(blocked), fixtureNavigation(blocked,'http://127.0.0.1:4174/?demo=1'));
    await clickButton(blocked, 'Planner');
    await generateExample(blocked);
    await clickButton(blocked, 'Save plan');
    await blocked.waitForSelector('.toast');
    assert.match(await blocked.$eval('.toast', (n) => n.textContent), /Could not save/);
    const afterBlockedSave = await blocked.evaluate(() => localStorage.getItem('compass-saved-plans'));
    assert.equal(afterBlockedSave, '{still here');
    await blocked.close();
    await blockedContext.close();
  } catch (error) { await reportJourneyFailure(browser); throw error; } finally {
    if (browser) await browser.close();
    server.kill();
  }
});

test('signed-out visitor is asked to log in before the plan reveals, brief kept', { timeout: 90000 }, async () => {
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', '4177', '--strictPort',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline && server.exitCode === null) {
      try {
        const response = await fetch('http://127.0.0.1:4177', { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) { ready = true; break; }
      } catch {
        // Retry only while the preview is starting, within the deadline.
      }
      await delay(100);
    }
    assert.ok(ready, 'Preview did not become ready');
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.setViewport({ width: 1440, height: 900 });
    await (await installAuthFixture(page), fixtureNavigation(page,'http://127.0.0.1:4177/?demo=1'));

    // Generate without a session: the gate asks for log-in and hides the plan.
    await clickButton(page, 'Fill it in for me');
    await page.waitForFunction(() => {
      const h = [...document.querySelectorAll('.planin h2')].find((el) => el.textContent.trim() === 'Your plan is ready');
      return Boolean(h);
    });
    assert.match(await page.$eval('.planin', (el) => el.textContent), /Log in to see it/);
    assert.equal(await page.$('.planin .metrics'), null);

    // The brief survives behind the gate: Back to my brief returns the answers.
    await clickButton(page, 'Back to my brief');
    await page.waitForSelector('#f-name');
    assert.notEqual(await page.$eval('#f-name', (input) => input.value), '');
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
