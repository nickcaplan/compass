import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import puppeteer from 'puppeteer-core';
const [,, out, base, route, name] = process.argv;
let url = base, server = null;
if (base === 'local') {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  url = await new Promise((res, rej) => { let o=''; const t=setTimeout(()=>rej(new Error('t')),15000); server.stdout.on('data', d=>{ o+=stripVTControlCharacters(d.toString()); const m=o.match(/http:\/\/127\.0\.0\.1:\d+\//); if(m){clearTimeout(t);res(m[0]);} }); });
}
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.evaluateOnNewDocument(t => localStorage.setItem('compass-theme', t), 'dark');
await p.goto(url + route, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
console.log('shot', name);
await b.close(); if (server) server.kill();
