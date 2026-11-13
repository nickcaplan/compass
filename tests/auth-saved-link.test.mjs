import {installAuthFixture} from './helpers/auth-fixtures.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Fixture credentials only. All provider requests are intercepted.
test('email login immediately preserves a restored saved-plan link in its account snapshot', { timeout: 60000 }, async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const local = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error('Preview not ready')), 10000);
      server.once('error', reject);
      server.stdout.on('data', chunk => {
        output += stripVTControlCharacters(chunk.toString());
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    const url = new URL(process.env.HOSTED_URL || local).href;
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'), headless: true, args: ['--no-sandbox'] });
    for (const width of [390, 1440]) {
      for (const mode of ['view', 'edit', 'missing']) {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setViewport({ width, height: 900 });
        const user = { id: 'saved-link-fixture', email: 'saved-link@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { full_name: 'Fixture', compass_profile_complete: true }, created_at: '2026-01-01T00:00:00Z' };
        await page.setRequestInterception(true);
        page.on('request', req => {
          if (!req.url().includes('ctailpmcoyvaplwbwskf.supabase.co')) return req.continue();
          const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
          if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers });
          const body = req.url().includes('/token') ? { access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user } : user;
          return req.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
        });
        await installAuthFixture(page);await page.goto(url + '?demo=1#/sign-in');
        await page.waitForSelector('#f-signin-email');
        await page.evaluate(mode => {
          const brief = { name: 'Restored saved campaign', objectives: ['awareness'], markets: ['uk'], kpis: ['Reach'], audiences: ['Scientist / Researcher'], budget: 10000, start: new Date(Date.now()+30*864e5).toISOString().slice(0,10), end: new Date(Date.now()+120*864e5).toISOString().slice(0,10) };
          const id = mode === 'missing' ? 'removed-entry' : 'saved-entry';
          const savedBrief = {...brief, name:'Original saved campaign'};
          localStorage.setItem('compass-saved-plans', JSON.stringify([{ id: 'saved-entry', savedAt: '2026-11-01T12:00:00Z', brief: mode==='edit'?savedBrief:brief }]));
          localStorage.setItem('compass-auth-draft:account:saved-link-fixture', JSON.stringify({ binding: { accountId: 'saved-link-fixture' }, brief, submittedBrief: brief, stage: 'plan', budgetText: '10000', savedEntry: { id, mode: mode === 'missing' ? 'view' : mode }, ts: Date.now() }));
        }, mode);
        await page.evaluate(()=>{window.snapshotWrites=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('compass-auth-draft:account:'))window.snapshotWrites.push(JSON.parse(v));return original.call(this,k,v)}});
        await page.locator('#f-signin-email').fill(user.email);
        await page.locator('#f-signin-password').fill('fixture-password-only');if(await page.$('input[id$="-confirm-password"]'))await page.locator('input[id$="-confirm-password"]').fill('fixture-password-only');
        await page.locator('form[aria-label="Email account"] .gen').click();
        await page.waitForSelector('.metrics');
        // Inspect the immediate synchronous stash, before any navigation or reload
        // can repair latestPlanner via the layout effect.
        const entry = await page.evaluate(() => window.snapshotWrites[0].savedEntry);
        assert.deepEqual(entry, mode === 'missing' ? null : { id: 'saved-entry', mode });
        await page.reload();
        await page.waitForSelector('.metrics');
        if (mode === 'view') {
          await page.waitForSelector('.bsum');
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save plan')), false);
        } else if (mode === 'edit') {
          assert.ok(await page.$('#f-name'));
          assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save changes')), true);
        }
        if(mode!=='missing'){
          assert.match(new URL(page.url()).hash,mode==='edit'?/saved-entry\/edit$/:/saved-entry$/);
          await page.reload();await page.waitForSelector('.metrics');
          if(mode==='edit'){
            await page.waitForFunction(()=>document.querySelector('#f-name')?.value==='Restored saved campaign');
            await page.locator('.navlinks button:nth-child(2)').click();await page.waitForSelector('[role=alertdialog]');
            await page.keyboard.press('Escape');await page.waitForSelector('[role=alertdialog]',{hidden:true});
            assert.equal(await page.$eval('#f-name',e=>e.value),'Restored saved campaign');
          }else await page.waitForSelector('.bsum');
        }
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('compass-saved-plans')).filter(p => p.id === 'saved-entry').length), 1);
        await context.close();
      }
    }
  } finally { await browser?.close(); server.kill(); }
});
