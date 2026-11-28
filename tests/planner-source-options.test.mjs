import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(readFileSync('src/plannerSourceOptions.ts','utf8')).replace(/^import type.*;$/m,'').replace('export ','');
const sourceOptions=new Function(code+';return sourceOptions')();
const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));
for(const market of ['UK','North America','France','Germany','Global'])for(const objective of ['Awareness','Consideration','Performance'])test(`exact source slice ${market}/${objective}`,()=>{
 const before=JSON.stringify(records), result=sourceOptions(records,market,[objective]);
 const expected=records.filter(r=>r.market===market&&r.objective===objective&&r.structurally_reviewable&&r.structural_issues.length===0);
 assert.equal(result.optionCount,expected.length);
 assert.deepEqual(result.groups.flatMap(g=>g.options).map(r=>r.id).sort(),expected.map(r=>r.id).sort());
 assert.equal(result.heldCount,records.filter(r=>r.market===market&&r.objective===objective).length-expected.length);
 for(const g of result.groups){assert.equal(g.description,g.options[0].tactic_description);for(const r of g.options){assert.equal(r.tactic,g.tactic);assert.strictEqual(r,records.find(x=>x.id===r.id));assert.equal(r.preferred,false);assert.equal(r.mock,true);}}
 assert.equal(result.recommendationReady,false);assert.equal(JSON.stringify(records),before,'no source mutation');
});
test('no fallback, no inferred audience or budget allocation',()=>{
 for(const [market,objectives]of [['', ['Awareness']],['Europe',['Awareness']],['UK',[]],['UK',['Invalid']]])assert.equal(sourceOptions(records,market,objectives).optionCount,0);
 const all=sourceOptions(records,'UK',['Awareness','Consideration','Awareness']);
 assert.equal(new Set(all.groups.flatMap(g=>g.options).map(r=>r.id)).size,all.optionCount);
 assert.equal(all.optionCount,328);assert.equal('allocatedBudget' in all,false);
});
test('invalid numbers and held rows never enter source options',()=>{
 const row=records.find(r=>r.structurally_reviewable&&r.market==='UK');
 for(const patch of [{estimated_source_cost:NaN},{expected_result:Infinity},{expected_result:-1},{structural_issues:['review']},{structurally_reviewable:false}]){
  const r=sourceOptions([{...row,...patch}],'UK',[row.objective]);assert.equal(r.optionCount,0);assert.equal(r.heldCount,1);
 }
});
