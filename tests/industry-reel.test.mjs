import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

async function visibleIndustry(page) {
  return page.$eval('.industry-reel', reel => {
    const viewport = reel.getBoundingClientRect();
    const center = viewport.top + viewport.height / 2;
    return [...reel.querySelectorAll('.industry-reel-track > span')].find(row => {
      const bounds = row.getBoundingClientRect();
      return center >= bounds.top && center < bounds.bottom;
    })?.textContent;
  });
}

test('industry reel settles in 2.6 seconds and never blocks interaction', { timeout: 60000 }, async () => {
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
      await page.evaluateOnNewDocument(()=>localStorage.setItem('sb-ctailpmcoyvaplwbwskf-auth-token',JSON.stringify({access_token:'test',refresh_token:'test',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'walk-test',email:'walk@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{full_name:'Walk Test',compass_profile_complete:true},created_at:'2026-01-01T00:00:00Z'}})));
    await page.goto(previewUrl);
      await page.waitForSelector('.industry-reel-track');
      await page.evaluate(() => document.fonts.ready);
      const before = await page.$eval('.hero', e => e.getBoundingClientRect().toJSON());
      const animation = await page.$eval('.industry-reel-track', e => {
        const a = e.getAnimations()[0]; a.currentTime = 650; a.play();
        return a.effect.getTiming().duration;
      });
      assert.equal(animation, 2600);
      await page.locator('#f-name').fill('Typing during the spin');
      assert.equal(await page.$eval('#f-name', e => e.value), 'Typing during the spin');
      await page.$eval('.industry-reel-track', e => e.getAnimations()[0].currentTime = 2600);
      assert.deepEqual(await page.$eval('.hero', e => e.getBoundingClientRect().toJSON()), before);
      assert.equal(await visibleIndustry(page), 'Life sciences');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      assert.equal(await page.$eval('.industry-reel-track', e => e.getAnimations().length), 0);
      assert.equal(await visibleIndustry(page), 'Life sciences');
      await page.close();
    }
  } finally { await browser?.close(); server.kill(); }
});
