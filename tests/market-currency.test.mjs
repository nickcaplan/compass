import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const code=stripTypeScriptTypes(readFileSync('src/data.ts','utf8')).replace(/^export /gm,'');
const {MARKET_CURRENCIES,FX_RATE_DATE,FX_RATE_SOURCE,FALLBACK_RATE_SET,convertCurrency,formatCurrency,isCurrencyCode,parseEcbRates}=new Function(`${code};return {MARKET_CURRENCIES,FX_RATE_DATE,FX_RATE_SOURCE,FALLBACK_RATE_SET,convertCurrency,formatCurrency,isCurrencyCode,parseEcbRates}`)();
const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));

test('each planner market has one display currency',()=>{
 assert.deepEqual(MARKET_CURRENCIES,{
  'north-america':'CAD',
  uk:'GBP',
  france:'EUR',
  germany:'EUR',
 });
 assert.equal(new Set(Object.values(MARKET_CURRENCIES)).size,3);
 assert.deepEqual(Object.values(MARKET_CURRENCIES).sort(),['CAD','EUR','EUR','GBP']);
});

test('ECB reference rates convert between workbook and market currencies',()=>{
 assert.equal(FX_RATE_SOURCE,'European Central Bank reference rates');
 assert.equal(FX_RATE_DATE,'24 November 2026');
 const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.000001,`${actual} != ${expected}`);
 close(convertCurrency(109.63,'USD','EUR'),100);
 close(convertCurrency(109.63,'USD','GBP'),83.7);
 close(convertCurrency(83.7,'GBP','EUR'),100);
 close(convertCurrency(109.63,'USD','CAD'),157.07);
 assert.equal(convertCurrency(100,'USD','USD'),100);
 assert.equal(convertCurrency(0,'USD','GBP'),0);
 assert.equal(convertCurrency(Number.NaN,'USD','GBP'),null);
 assert.equal(convertCurrency(-1,'USD','GBP'),null);
 assert.equal(convertCurrency(100,'JPY','GBP'),null);
});

test('currency formatting is explicit and current workbook currencies are supported',()=>{
 assert.equal(formatCurrency(60000,'GBP'),'£60,000');
 assert.equal(formatCurrency(60000,'USD'),'US$60,000');
 assert.equal(formatCurrency(60000,'EUR'),'€60,000');
 assert.equal(isCurrencyCode('USD'),true);
 assert.equal(isCurrencyCode('JPY'),false);
 assert.deepEqual([...new Set(records.map(row=>row.declared_currency))],['USD']);
 assert.ok(records.every(row=>isCurrencyCode(row.declared_currency)),'every workbook source currency can be converted');
});

const ecbSample={dataSets:[{series:{'0:0:0:0:0':{observations:{'0':[1.5707,0,0,null,null]}},'0:1:0:0:0':{observations:{'0':[0.837,0,0,null,null]}},'0:2:0:0:0':{observations:{'0':[1.0963,0,0,null,null]}}}}],structure:{dimensions:{series:[{id:'FREQ',values:[{id:'D'}]},{id:'CURRENCY',values:[{id:'CAD'},{id:'GBP'},{id:'USD'}]}],observation:[{id:'TIME_PERIOD',values:[{id:'2026-11-24'}]}]}}};

test('live ECB response parses to a dated rate set and anything else is rejected',()=>{
 const live=parseEcbRates(ecbSample);
 assert.deepEqual(live,{rates:{EUR:1,USD:1.0963,GBP:0.837,CAD:1.5707},date:'24 November 2026',live:true});
 const newer=structuredClone(ecbSample);newer.structure.dimensions.observation[0].values=[{id:'2026-11-25'}];newer.dataSets[0].series['0:2:0:0:0'].observations['0']=[1.1];
 const set=parseEcbRates(newer);assert.equal(set.date,'25 November 2026');assert.equal(set.rates.USD,1.1);
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);
 close(convertCurrency(110,'USD','EUR',set.rates),100);
 const missing=structuredClone(ecbSample);delete missing.dataSets[0].series['0:0:0:0:0'];
 assert.equal(parseEcbRates(missing),null);
 const zero=structuredClone(ecbSample);zero.dataSets[0].series['0:1:0:0:0'].observations['0']=[0];
 assert.equal(parseEcbRates(zero),null);
 const baddate=structuredClone(ecbSample);baddate.structure.dimensions.observation[0].values=[{id:'soon'}];
 assert.equal(parseEcbRates(baddate),null);
 for(const junk of [null,undefined,{},'x',[]])assert.equal(parseEcbRates(junk),null);
});

test('fallback rate set is the dated snapshot and is not marked live',()=>{
 assert.equal(FALLBACK_RATE_SET.live,false);
 assert.equal(FALLBACK_RATE_SET.date,FX_RATE_DATE);
 assert.equal(convertCurrency(109.63,'USD','EUR',FALLBACK_RATE_SET.rates)>99.99999,true);
});
