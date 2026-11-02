import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

// Run npm run build first. Chrome is preinstalled on GitHub's ubuntu-latest
// runner; on macOS this uses the standard Google Chrome application path.
const chromePath = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome';

test('PDF gold feedback preserves layout, text and dismissal in generated and saved views', { timeout: 60000 }, async () => {
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
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage(); await page.setViewport({width,height:900});
      await page.goto(previewUrl); await page.waitForSelector('.demofill'); await page.locator('.demofill').click();
      await page.waitForFunction(()=>!document.querySelector('.gen').disabled); await page.evaluate(()=>document.querySelector('.gen').click()); await page.waitForSelector('.cs-wrap button');
      for (const saved of [false,true]) {
        if(saved){await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save plan').click());await page.waitForSelector('.bsum');}
        await page.$eval('.cs-wrap button',e=>e.scrollIntoView({block:'center'}));
        const button=await page.$eval('.cs-wrap button',e=>({width:e.offsetWidth,height:e.offsetHeight,left:e.offsetLeft,top:e.offsetTop}));
        await page.locator('.cs-wrap button').click(); await page.waitForSelector('.cs-bubble');
        assert.deepEqual(await page.$eval('.cs-wrap button',e=>({width:e.offsetWidth,height:e.offsetHeight,left:e.offsetLeft,top:e.offsetTop})),button);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const overlap=await page.evaluate(()=>{const a=document.querySelector('.cs-label').getBoundingClientRect();const b=document.querySelector('.cs-bubble').getBoundingClientRect();return a.right>b.left});assert.equal(overlap,false);
        await page.keyboard.press('Escape');await page.waitForSelector('.cs-bubble',{hidden:true});
        await page.locator('.cs-wrap button').click(); await page.waitForSelector('.cs-bubble');await page.waitForSelector('.cs-bubble',{hidden:true});
      }
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.locator('.cs-wrap button').click();await page.waitForSelector('.cs-bubble');assert.equal(await page.$eval('.cs-bubble',e=>e.getAnimations().length),0);await page.close();
    }
  } finally { await browser?.close(); server.kill(); }
});
