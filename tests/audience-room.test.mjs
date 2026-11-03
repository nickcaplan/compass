import assert from 'node:assert/strict';import test from 'node:test';import {spawn}from'node:child_process';import puppeteer from'puppeteer-core';
test('natural audience rows use available space and retain narrow and enlarged-text fallback',{timeout:60000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let b;
 try{const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('preview timeout')),10000);s.stdout.on('data',c=>{out+=c.toString().replace(/\x1b\[[0-9;]*m/g,'');const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 b=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true});
 for(const width of[320,375,390,414,768,980,981,1200,1440])for(const variant of['loaded','fallback','double']){
 const p=await b.newPage();await p.setViewport({width,height:900});await p.goto(url+'?demo=1');await p.waitForSelector('[aria-labelledby=g-audience]');await p.evaluate(()=>document.fonts.ready);if(variant==='loaded')assert.equal(await p.evaluate(()=>[...document.fonts].some(f=>f.family.replaceAll('\"','')==='Roboto'&&f.status==='loaded')),true,'Roboto must actually load for loaded-font geometry');
 if(variant==='fallback')await p.addStyleTag({content:'.pill{font-family:Arial,sans-serif}'});
 if(variant==='double')await p.addStyleTag({content:'.pill{font-size:26px}'});
 const g=await p.$$eval('[aria-labelledby=g-audience] button',bs=>bs.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,clip:e.scrollWidth>e.clientWidth}}));
 assert.ok(g.every(e=>!e.clip));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(variant!=='double'){
 assert.ok(g.every(e=>e.h===g[0].h));
 const w=await p.$eval('[aria-labelledby=g-audience]',e=>e.clientWidth);
 if(g[2].w+g[3].w+8<=w)assert.equal(g[2].y,g[3].y);else assert.ok(g[2].y<g[3].y);
 if(variant==='loaded'&&(width===390||width===1440))assert.equal(g[2].y,g[3].y);
 }
 await p.$eval('[aria-labelledby=g-audience]',e=>e.scrollIntoView({block:'center'}));
 if(process.env.SCREENSHOT_DIR&&(width===390||width===1440))await p.screenshot({path:`${process.env.SCREENSHOT_DIR}/room-${width}-${variant}.png`});
 await p.close();
 }
 }finally{await b?.close();s.kill()}
});
