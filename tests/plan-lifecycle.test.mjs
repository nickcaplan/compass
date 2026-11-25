import { installAuthFixture, fixtureNavigation } from './helpers/auth-fixtures.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

async function clickButton(page, label) {
  await page.waitForSelector('.toast', { hidden: true });
  const findButton = new Function(
    `return [...document.querySelectorAll('button')].find(button => button.textContent.trim().replace(/\s*→$/, '') === ${JSON.stringify(label)})`);
  await page.locator(findButton).click();
}

async function startPreview(port) {
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', String(port), '--strictPort',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.ok) return server;
    } catch {}
    await delay(100);
  }
  server.kill();
  throw new Error(`Preview did not become ready on ${port}`);
}

async function openSavedPlan(page) {
  await clickButton(page, 'My plans');
  await page.waitForSelector('.pc-actions');
  await clickButton(page, 'Open plan');
}

async function generateExample(page) {
  await clickButton(page, 'Fill it in for me');
  await page.waitForSelector('.planin .sp-results', { timeout: 40000 });
  assert.match(await page.$eval('.sp-results', e => e.textContent), /Source options\. No allocated plan\./);
}

async function signInTestUser(page) {
  await page.setRequestInterception(true);
  page.on('request', r => r.url().includes('supabase.co') ? r.abort() : r.continue());
  await installAuthFixture(page);
  await page.evaluateOnNewDocument(async () => {
    const session = {
      access_token: 'test-access-token', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'test-refresh-token',
      user: {
        id: 'test-user-id', aud: 'authenticated', role: 'authenticated', email: 'test@example.com',
        app_metadata: {}, user_metadata: { full_name: 'Test User', compass_profile_complete: true },
        created_at: '2026-01-01T00:00:00Z',
      },
    };
    await window.fixtureAuth.setItem('sb-ctailpmcoyvaplwbwskf-auth-token', JSON.stringify(session));
  });
}

test('saved-plan replacement protects unsaved answers', { timeout: 90000 }, async (t) => {
  const server = await startPreview(4173);
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1440, height: 900 });
    await installAuthFixture(page);
    await fixtureNavigation(page, 'http://127.0.0.1:4173/?demo=1');
    await page.waitForFunction(() => location.hash === '#/planner');

    await generateExample(page);
    assert.equal(await page.$('#f-gate-email'), null, 'source options do not require sign-in');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save plan')), true);

    await signInTestUser(page);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.signin')?.getAttribute('aria-label')?.includes('test@example.com'));
    assert.equal(await page.$eval('.signin .avatar', e => e.textContent?.trim()), 'TU');

    let currentName = await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.name);
    await page.evaluate(() => {
      const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
      const start = new Date(Date.now() + 30 * 864e5);
      const end = new Date(Date.now() + 113 * 864e5);
      const iso = d => d.toISOString().slice(0, 10);
      plans[0].brief.start = iso(start);
      plans[0].brief.end = iso(end);
      localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.signin')?.getAttribute('aria-label')?.includes('test@example.com'));
    await openSavedPlan(page);
    await page.waitForSelector('.bsum');
    assert.equal(await page.$eval('.cap', e => e.textContent), 'SAVED PLAN - READ ONLY');
    assert.ok(await page.waitForSelector('.sp-results'), 'existing saved plans open as source options');

    await t.test('saved plan still warns after its form is edited', async () => {
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Unsaved campaign name');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', e => e.textContent), /Discard unsaved changes/);
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', e => e.value), 'Unsaved campaign name');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .btn').click();
      await page.waitForSelector('.plancard');
      await clickButton(page, 'Open plan');
      await page.waitForSelector('.bsum');
      assert.equal(await page.$eval('.bsum .v', e => e.textContent), currentName);
    });

    await t.test('reopening an unchanged saved view needs no confirmation', async () => {
      await openSavedPlan(page);
      await page.waitForSelector('.bsum');
      assert.equal(await page.$('[role="alertdialog"]'), null);
    });

    await t.test('saving an edited plan confirms with the Saved state', async () => {
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Saved spring rename');
      await page.waitForFunction(() => !document.querySelector('.gen')?.disabled);
      await page.evaluate(() => document.querySelector('.gen').click());
      await page.waitForSelector('.planin .sp-results', { timeout: 40000 });
      assert.equal(await page.$eval('.cta b', e => e.textContent), 'A Hybrid House specialist can pick it up from here.');
      await clickButton(page, 'Save changes');
      await page.waitForFunction(() => document.querySelector('.secondary .saved')?.textContent.trim() === 'Saved');
      await page.waitForSelector('.bsum');
      currentName = await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.name);
      assert.equal(currentName, 'Saved spring rename');
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
      assert.equal(await page.$eval('.plancard .chip', e => e.textContent), 'Expired');
      await page.evaluate(({ start, end }) => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        plans[0].brief.start = start;
        plans[0].brief.end = end;
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      }, originalDates);
      await page.reload();
      await openSavedPlan(page);
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
      assert.equal(await page.$eval('#f-name', e => e.value), 'Edited saved plan');
      await clickButton(page, 'Cancel');
      await page.waitForSelector('.bsum');
    });

    await t.test('draft replacement warns and Escape preserves answers', async () => {
      await clickButton(page, 'Create another');
      await page.locator('#f-name').fill('Unfinished draft');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', e => e.textContent), /Replace your draft/);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await clickButton(page, 'Planner');
      assert.equal(await page.$eval('#f-name', e => e.value), 'Unfinished draft');
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      await page.locator('.confirm .btn').click();
      await page.waitForSelector('.plancard');
      await clickButton(page, 'Open plan');
      await page.waitForSelector('.bsum');
    });

    await t.test('an unsaved generated source-option result still requires confirmation', async () => {
      await clickButton(page, 'Create another');
      await generateExample(page);
      await clickButton(page, 'My plans');
      await page.waitForSelector('[role="alertdialog"]');
      assert.match(await page.$eval('.confirm', e => e.textContent), /Replace your current plan/);
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
      const bounds = await page.$eval('.confirm', dialog => {
        const rect = dialog.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: window.innerHeight };
      });
      assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.height);
      await page.locator('.confirm .ghost').click();
      await page.waitForSelector('[role="alertdialog"]', { hidden: true });
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluate(name => {
        const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
        plans[0].brief.name = name;
        localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
      }, currentName);
      await page.reload();
    });

    await t.test('cancelling after another tab deletes the plan clears the saved view', async () => {
      const savedName = await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief.name);
      await openSavedPlan(page);
      await page.waitForSelector('.bsum');
      await clickButton(page, 'Edit plan');
      await page.locator('#f-name').fill('Unsaved edit to deleted plan');
      const otherPage = await context.newPage();
      try {
        await installAuthFixture(otherPage);
        await fixtureNavigation(otherPage, 'http://127.0.0.1:4173/?demo=1#/my-plans');
        await otherPage.waitForSelector('.pc-actions');
        await otherPage.locator('.pc-delete').click();
        await otherPage.waitForSelector('[role="alertdialog"]');
        await otherPage.locator('.confirm .btn').click();
        await otherPage.waitForSelector('[role="alertdialog"]', { hidden: true });
      } finally { await otherPage.close(); }
      await clickButton(page, 'Cancel');
      await page.waitForSelector('.bsum', { hidden: true });
      assert.match(await page.$eval('.toast', e => e.textContent), /no longer in My plans/);
      await clickButton(page, 'My plans');
      assert.equal(await page.evaluate(name => [...document.querySelectorAll('.plancard')].filter(c => c.textContent.includes(name)).length, savedName), 0);
    });
  } finally {
    await browser?.close();
    server.kill();
  }
});

test('seeded demo plans appear for a fresh visitor, stay deleted, and never override user plans', { timeout: 90000 }, async () => {
  const server = await startPreview(4175);
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const page = await (await browser.createBrowserContext()).newPage();
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1440, height: 900 });
    await installAuthFixture(page);
    await fixtureNavigation(page, 'http://127.0.0.1:4175/?demo=1');
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    const cardNames = () => page.$$eval('.plancard b', els => els.map(e => e.textContent));
    assert.equal((await cardNames()).length, 7);
    assert.equal(await page.$$eval('.chip', els => els.filter(e => e.textContent.trim() === 'Expired').length), 5);

    await page.evaluate(() => {
      const plans = JSON.parse(localStorage.getItem('compass-saved-plans'));
      plans.unshift({ id: 'visitor-plan', savedAt: new Date().toISOString(), brief: { ...plans[0].brief, name: "Visitor's own campaign" } });
      localStorage.setItem('compass-saved-plans', JSON.stringify(plans));
    });
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    const names = await cardNames();
    assert.equal(names.length, 8);
    assert.ok(names[0].startsWith("Visitor's own campaign"));

    const deleteHandle = await page.evaluateHandle(() => [...document.querySelectorAll('.plancard')].find(c => c.textContent.includes('Global Reagent Launch'))?.querySelector('button.pc-delete'));
    await deleteHandle.asElement().click();
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
    assert.ok(!afterDelete.plans.some(p => p.id === 'seed-past-2'));
    assert.ok(afterDelete.meta.applied.includes('seed-past-2'));
  } finally {
    await browser?.close();
    server.kill();
  }
});

test('corrupt saved plans are moved aside with a notice and recovery keeps the backup', { timeout: 90000 }, async () => {
  const server = await startPreview(4174);
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1440, height: 900 });
    await installAuthFixture(page);
    await fixtureNavigation(page, 'http://127.0.0.1:4174/?demo=1');
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    assert.equal(await page.$('.notice'), null);
    const seedBrief = await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans'))[0].brief);

    await page.evaluate(() => localStorage.setItem('compass-saved-plans', '{not json'));
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.notice');
    assert.match(await page.$eval('.notice', e => e.textContent), /could not be fully read on this device/);
    assert.equal(await page.evaluate(() => localStorage.getItem('compass-saved-plans')), null);
    await page.locator('.notice .ghost').click();
    await page.waitForSelector('.notice', { hidden: true });

    await page.evaluate(brief => localStorage.setItem('compass-saved-plans', JSON.stringify([{ id: 'recovered-plan', savedAt: new Date().toISOString(), brief }])), seedBrief);
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.plancard');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans-corrupt')).length), 1);

    await page.evaluate(() => localStorage.setItem('compass-saved-plans', '["broken too"'));
    await page.reload();
    await clickButton(page, 'My plans');
    await page.waitForSelector('.notice');
    const twice = await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans-corrupt')).map(b => b.payload));
    assert.deepEqual(twice, ['{not json', '["broken too"']);

    const blockedContext = await browser.createBrowserContext();
    const blocked = await blockedContext.newPage();
    blocked.setDefaultTimeout(20000);
    await blocked.evaluateOnNewDocument(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === 'compass-saved-plans-corrupt') throw new DOMException('quota', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await installAuthFixture(blocked);
    await fixtureNavigation(blocked, 'http://127.0.0.1:4174/?demo=1');
    await blocked.evaluate(() => localStorage.setItem('compass-saved-plans', '{still here'));
    await blocked.reload();
    await clickButton(blocked, 'My plans');
    await blocked.waitForSelector('[role="alert"]');
    assert.match(await blocked.$eval('[role="alert"]', e => e.textContent), /could not be loaded safely/);
    assert.equal(await blocked.$('.empty'), null);
    assert.equal(await blocked.$('.plancard'), null);
    assert.equal(await blocked.evaluate(() => localStorage.getItem('compass-saved-plans')), '{still here');
    await blockedContext.close();
  } finally {
    await browser?.close();
    server.kill();
  }
});

test('signed-out visitor sees source options immediately and keeps the filled brief', { timeout: 90000 }, async () => {
  const server = await startPreview(4177);
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    const page = await (await browser.createBrowserContext()).newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await installAuthFixture(page);
    await fixtureNavigation(page, 'http://127.0.0.1:4177/?demo=1');
    await clickButton(page, 'Fill it in for me');
    await page.waitForSelector('.sp-results');
    assert.equal(await page.$('#f-gate-email'), null);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save plan')), true);
    assert.notEqual(await page.$eval('#f-name', e => e.value), '');
    assert.doesNotMatch(await page.$eval('.sp-results', e => e.textContent), /not built yet/);
    await clickButton(page, 'Create another');
    await page.waitForSelector('[role="alertdialog"]');
    await page.locator('.confirm .btn').click();
    await page.waitForSelector('#f-name');
    assert.equal(await page.$eval('#f-name', e => e.value), '');
  } finally {
    await browser?.close();
    server.kill();
  }
});
