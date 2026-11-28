import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {browseInventory,buildRecommendation} from './inventory-adapter.mjs';
const d=JSON.parse(fs.readFileSync(new URL('../../src/inventory.mock.json',import.meta.url)));
test('all rows imported with provenance and unique IDs',()=>{assert.equal(d.records.length,1745);assert.equal(new Set(d.records.map(r=>r.id)).size,1745);assert.ok(d.records.every(r=>r.source_excel_row>=2&&r.raw['Source File']));});
test('all 11 tactics classified, none held, each joined to its rule and description',()=>{const t=new Set(d.records.map(r=>r.tactic));assert.equal(t.size,11);assert.ok(!t.has('Other / Review')&&!t.has('Other'));for(const x of t){assert.ok(d.rules[x],x);assert.ok(d.descriptions[x],x);}assert.ok(d.records.every(r=>!r.structural_issues.length&&r.structurally_reviewable));});
test('GBP absent, preferred off, mock label retained',()=>{assert.ok(d.records.every(r=>r.gbp_cost===null&&!r.preferred&&r.mock&&!r.production_eligible));});
test('market exact matching does not include Global',()=>{const groups=browseInventory(d,{markets:['UK'],objectives:['Awareness','Consideration','Performance']});assert.ok(groups.length>0);assert.ok(groups.flatMap(g=>g.options).every(r=>r.market==='UK'));});
test('unknown/empty market fails closed',()=>{assert.deepEqual(browseInventory(d,{markets:['Europe'],objectives:['Awareness']}),[]);assert.deepEqual(browseInventory(d),[]);});
test('objective exact matching and quarantine enforced',()=>{const g=browseInventory(d,{markets:['UK'],objectives:['Awareness']});assert.ok(g.flatMap(x=>x.options).every(r=>r.objective==='Awareness'&&!r.structural_issues.length));});
test('one description per tactic group',()=>{const g=browseInventory(d,{markets:['UK'],objectives:['Consideration']});assert.equal(g.length,new Set(g.map(x=>x.tactic)).size);assert.ok(g.every(x=>x.description));});
test('unapproved audience/currency rules never yield recommendation',()=>{const p=buildRecommendation(d,{markets:['UK'],objectives:['Awareness'],audiences:['Scientist / Researcher'],budget:10000});assert.equal(p.status,'needs_business_rules');assert.deepEqual(p.groups,[]);assert.ok(p.reviewGroups.length);});
const near=(a,b)=>Math.abs(a-b)<=0.011;
test('USD only, 170 priority-1 rows, six audience flags and a rationale on every row',()=>{assert.ok(d.records.every(r=>r.declared_currency==='USD'&&r.raw.Currency==='USD'));assert.equal(d.records.filter(r=>r.priority===1).length,170);for(const t of new Set(d.records.map(r=>r.tactic)))assert.ok(d.records.some(r=>r.tactic===t&&r.priority===1),t);assert.ok(d.records.every(r=>[1,2,3,4,5].includes(r.priority)&&Object.keys(r.audience_fit).length===6&&r.selection_rationale&&r.why_tactic));});
test('no price-like product names and no CPM above 1,000',()=>{assert.ok(d.records.every(r=>/[A-Za-z]/.test(r.product)));assert.ok(d.records.filter(r=>r.raw['Buying Model']==='CPM').every(r=>r.raw['Cost / Rate']<=1000));});
test('brief section 6: CPM, CTR and CPL recalculated, cached workbook results not used',()=>{
 let cpm=0,ctr=0,cpl=0,flat=0;
 for(const r of d.records){const w=r.raw,rate=w['Cost / Rate'],vol=w['Forecast Base Volume']||5000;
  if(w['Buying Model']==='CPM'){cpm++;assert.ok(near(r.estimated_source_cost,vol/1000*rate));assert.equal(r.expected_result,vol);}
  else if(w['Buying Model']==='CPL'){cpl++;assert.ok(near(r.estimated_source_cost,100*rate));assert.equal(r.expected_result,100);}
  else{flat++;assert.ok(near(r.estimated_source_cost,rate));}
  if(w['Primary KPI']==='CTR'){ctr++;assert.ok(Math.abs(r.expected_result-vol*w['KPI Assumption'])<=0.5);}
  if(['Impressions','Reach'].includes(w['Primary KPI']))assert.equal(r.expected_result,vol);}
 assert.deepEqual([cpm,cpl,ctr,flat],[380,95,455,1270]);});
test('the brief examples hold',()=>{const cpl=d.records.find(r=>r.raw['Buying Model']==='CPL'&&r.raw['Cost / Rate']===171.75);assert.equal(cpl.expected_result,100);assert.ok(near(cpl.estimated_source_cost,17175));assert.equal(cpl.source_cached_cost,171.75,'old cached cost kept only for audit');});
test('Reach, Impressions and count KPIs never multiply volume by a count',()=>{assert.ok(d.records.every(r=>r.expected_result<=Math.max(r.raw['Forecast Base Volume']||5000,r.raw['KPI Assumption']>1?r.raw['KPI Assumption']:0)));});
test('all four workbook tabs are imported; READ ME is guidance, not inventory',()=>{assert.ok(d.readme.length>=25);assert.ok(d.readme.some(x=>x.topic==='Scope'&&/1,745 records/.test(x.note)));assert.ok(!d.records.some(r=>r.source_sheet==='READ ME'));assert.equal(Object.keys(d.rules).length,13);assert.equal(Object.keys(d.descriptions).length,13);});
test('display text is clean: no demo numbering, no prices or pipes in placement and source page',()=>{assert.ok(d.records.every(r=>!/\(demo \d+\)/.test(r.product)&&!/\(demo \d+\)/.test(r.selection_rationale)));assert.ok(d.records.every(r=>!/[|$£€\t•]/.test(r.placement)&&!/\|/.test(r.source_page)));assert.ok(d.records.every(r=>r.raw['Placement']!==undefined&&r.raw['Source Page']!==undefined),'raw source text is kept untouched');});
