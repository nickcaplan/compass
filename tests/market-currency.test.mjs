import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const code=stripTypeScriptTypes(readFileSync('src/data.ts','utf8')).replace(/^export /gm,'');
const {MARKET_CURRENCIES,FX_RATE_DATE,FX_RATE_SOURCE,convertCurrency,formatCurrency,isCurrencyCode}=new Function(`${code};return {MARKET_CURRENCIES,FX_RATE_DATE,FX_RATE_SOURCE,convertCurrency,formatCurrency,isCurrencyCode}`)();
const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));

test('each planner market has one display currency',()=>{
 assert.deepEqual(MARKET_CURRENCIES,{
  'north-america':'USD',
  uk:'GBP',
  france:'EUR',
  germany:'EUR',
 });
 assert.equal(new Set(Object.values(MARKET_CURRENCIES)).size,3);
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
