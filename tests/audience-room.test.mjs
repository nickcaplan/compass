import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';import test from 'node:test';import {spawn}from'node:child_process';import puppeteer from'puppeteer-core';
const robotoFixtureCss=[400,500,700].map(weight=>`@font-face{font-family:Roboto;font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(new URL(`./fixtures/roboto/Roboto-${weight}.ttf`,import.meta.url)).toString('base64')}) format('truetype')}`).join('');
test('natural audience rows use available space and retain narrow and enlarged-text fallback',{timeout:60000},async()=>{
 const s=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});let b;
 try{const url=process.env.HOSTED_URL||await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('preview timeout')),10000);s.stdout.on('data',c=>{out+=c.toString().replace(/\x1b\[[0-9;]*m/g,'');const m=out.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m){clearTimeout(timer);resolve(m[0])}})});
 b=await puppeteer.launch({executablePath:process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'),headless:true});
 for(const width of[320,375,390,414,768,980,981,1200,1440])for(const variant of['loaded','fallback','double']){
 const p=await b.newPage();await p.setViewport({width,height:900});await p.setRequestInterception(true);p.on('request',r=>{const host=new URL(r.url()).hostname;if(host==='fonts.googleapis.com'||host==='fonts.gstatic.com')void r.abort();else void r.continue()});await p.goto(url+'?demo=1');await p.addStyleTag({content:robotoFixtureCss});await p.waitForSelector('[aria-labelledby=g-audience]');await p.evaluate(()=>document.fonts.ready);if(variant==='loaded')assert.equal(await p.evaluate(()=>[...document.fonts].some(f=>f.family.replaceAll('"','')==='Roboto'&&f.status==='loaded')),true,'Roboto must actually load for loaded-font geometry');
 if(variant==='fallback')await p.addStyleTag({content:'.pill{font-family:Arial,sans-serif}'});
 if(variant==='double')await p.addStyleTag({content:'.pill{font-size:26px}'});
 const objectives=await p.$$eval('[aria-labelledby=g-objective] button',bs=>bs.map(e=>{const r=e.getBoundingClientRect();return{y:r.y,w:r.width,clip:e.scrollWidth>e.clientWidth}}));
 assert.ok(objectives.every(e=>!e.clip));
 if(width>980&&variant!=='double')assert.equal(new Set(objectives.map(e=>e.y)).size,1,'desktop objective options share one row');
 const g=await p.$$eval('[aria-labelledby=g-audience] button',bs=>bs.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,clip:e.scrollWidth>e.clientWidth}}));
 assert.ok(g.every(e=>!e.clip));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(variant!=='double'){
 assert.ok(g.every(e=>e.h===g[0].h));
 const w=await p.$eval('[aria-labelledby=g-audience]',e=>e.clientWidth);
 let used=0;for(let i=0;i<g.length;i++){const fits=i>0&&used+8+g[i].w<=w+1;if(i>0)assert.equal(g[i].y===g[i-1].y,fits,'natural rows must pack every preceding pill, not an isolated pair');used=fits?used+8+g[i].w:g[i].w;}
 if(variant==='loaded'&&width===390)assert.equal(g[2].y,g[3].y);
 }
 await p.$eval('[aria-labelledby=g-audience]',e=>e.scrollIntoView({block:'center'}));
 if(process.env.SCREENSHOT_DIR&&(width===390||width===1440))await p.screenshot({path:`${process.env.SCREENSHOT_DIR}/room-${width}-${variant}.png`});
 await p.close();
 }
 }finally{await b?.close();s.kill()}
});
