import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRates} from '../scripts/refresh-fallback-rates.mjs';

const source=readFileSync('src/data.ts','utf8');
const rate=(day,over={})=>({live:true,date:day,rates:{EUR:1,USD:1.1,GBP:0.84,CAD:1.56,...over}});
const saved=/FX_RATE_DATE = '([^']+)'/.exec(source)[1];
const later=new Date(Date.parse(`${saved} UTC`)+2*864e5).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const earlier=new Date(Date.parse(`${saved} UTC`)-864e5).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

test('a newer ECB day rewrites only the fallback block',()=>{
 const next=applyRates(source,rate(later));
 assert.match(next,new RegExp(`FX_RATE_DATE = '${later}'`));
 assert.match(next,/USD: 1\.1,\n  GBP: 0\.84,\n  CAD: 1\.56,/);
 const strip=t=>t.replace(/\/\/ fallback-rates:start[\s\S]*\/\/ fallback-rates:end/,'');
 assert.equal(strip(next),strip(source),'nothing outside the markers changes');
 assert.equal(applyRates(next,rate(later)),null,'same day again is a no-op');
});
test('same-day, older, partial or wild rates are refused or ignored',()=>{
 assert.equal(applyRates(source,rate(saved)),null);
 assert.throws(()=>applyRates(source,rate(earlier)),/older/);
 assert.throws(()=>applyRates(source,rate(later,{CAD:0})),/Bad CAD/);
 assert.throws(()=>applyRates(source,rate(later,{USD:2.5})),/out of range/);
 assert.throws(()=>applyRates(source,null),/No usable/);
 assert.throws(()=>applyRates(source,{live:false,date:later,rates:{}}),/No usable/);
});
