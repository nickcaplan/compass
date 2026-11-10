import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

test('equal active card Edit/Open actions use selected colours and correct edit/discard routes', { timeout: 90000 }, async () => {
  const server = process.env.HOSTED_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const url = process.env.HOSTED_URL || await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Preview startup timeout')), 10000);
      server.once('error', reject);
      let output = '';
      server.stdout.on('data', data => {
        output += stripVTControlCharacters(data.toString());
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
    for (const width of [320, 390, 1440]) for (const theme of ['dark', 'light']) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width, height: 900 });
      await page.goto(url + '?demo=1#/my-plans');
      await page.waitForSelector('.plancard');
      await page.evaluate(t => localStorage.setItem('compass-theme', t), theme);
      await page.reload();
      await page.waitForSelector('.plancard');
      await page.waitForSelector('.toast', { hidden: true });
      await page.evaluate(() => document.fonts.ready);
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/cards-${width}-${theme}-full.png`, fullPage: true });
      if (process.env.BEFORE) { await context.close(); continue; }
      assert.equal(await page.$$eval('.is-expired .pc-edit', els => els.length), 0);
      assert.equal(await page.$$eval('.pc-edit', els => els.length), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const actions = await page.$eval('.pc-actions', el => [...el.children].map(b => ({ width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height, background: getComputedStyle(b).backgroundImage, color: getComputedStyle(b).color, border: getComputedStyle(b).borderColor })));
      assert.ok(actions.every(b => b.height >= 44));
      assert.ok(Math.abs(actions[0].width - actions[1].width) < 1, JSON.stringify(actions));
      assert.match(actions[0].background, /gradient/);
      assert.equal(actions[1].background, 'none');
      await page.locator('.pc-edit').click();
      await page.waitForSelector('#f-name');
      assert.match(await page.$eval('h1', el => el.textContent), /UK Laboratory/);
      await page.locator('.saved-back').click();
      await page.waitForSelector('.plancard');
      assert.equal(await page.$('[role=alertdialog]'), null);
      await page.locator('.pc-open').click();
      await page.waitForSelector('.bsum');
      assert.equal(await page.$('#f-name'), null);
      assert.ok(await page.$('.saved-plan-copy'));
      assert.ok(await page.$('.pdf-report button'));
      await page.locator('.saved-back').click();
      await page.waitForSelector('.pc-edit');
      await page.locator('.pc-edit').click();
      await page.waitForSelector('#f-name');
      await page.type('#f-name', ' changed');
      await page.locator('.saved-back').click();
      await page.waitForSelector('[role=alertdialog]');
      await page.$$eval('[role=alertdialog] button', bs => bs.find(b => /discard/i.test(b.textContent)).click());
      await page.waitForSelector('.pc-open');
      await page.locator('.pc-open').click();
      await page.waitForSelector('.bsum');
      assert.doesNotMatch(await page.$eval('h1', el => el.textContent), /changed/);
      await context.close();
    }
  } finally { await browser?.close(); server?.kill(); }
});
