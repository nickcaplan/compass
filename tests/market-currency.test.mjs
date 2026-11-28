import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

// Ben's 27 November amends, confirmed by Nick on 28 November: US dollars only, no conversion.
const code=stripTypeScriptTypes(readFileSync('src/data.ts','utf8')).replace(/^export /gm,'');
const {usd}=new Function(`${code};return {usd}`)();
const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));

test('every workbook price is USD and shown as dollars',()=>{
 assert.deepEqual([...new Set(records.map(row=>row.declared_currency))],['USD']);
 assert.equal(usd(60000),'$60,000');
 assert.equal(usd(25000),'$25,000');
 assert.equal(usd(18.32),'$18');
 assert.equal(usd(0),'$0');
});

test('no conversion code, rates or non-dollar symbols remain in the app source',()=>{
 assert.equal(existsSync('src/fxRates.ts'),false);
 for(const file of readdirSync('src').filter(f=>/\.(ts|tsx)$/.test(f)&&!/^report(Brand|Font)/.test(f))){
  const text=readFileSync('src/'+file,'utf8');
  assert.doesNotMatch(text,/data-api\.ecb|startRateFetch|convertCurrency|MARKET_CURRENCIES|FALLBACK_RATE|CA\$|£|€/,file);
 }
 assert.doesNotMatch(readFileSync('src/data.ts','utf8'),/\bGBP\b|\bCAD\b|\bEUR\b/);
});
