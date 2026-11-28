import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(readFileSync('src/plannerSourceOptions.ts','utf8')).replace(/^import type.*;$/m,'').replace(/export /g,'');
const select=new Function(code+';return selectSourceOptions')();
const {records}=JSON.parse(readFileSync('src/inventory.mock.json','utf8'));
const dataSrc=readFileSync('src/data.ts','utf8');
const kpiRowValues={Reach:['Reach'],Impressions:['Impressions'],Clicks:['CTR','Clicks'],Listens:['Listens'],Registrations:['Registrations'],CPL:['CPL']};
const A={label:'Awareness',kpis:['Reach','Impressions','Clicks','Listens']},C={label:'Consideration',kpis:['Registrations','Clicks','Impressions']},P={label:'Performance',kpis:['CPL']};
const AUD=['Procurement','Laboratory Manager','Laboratory Technician','Scientist / Researcher','Purchasing Manager','Quality / Compliance'];
const run=(o)=>select(records,{market:'UK',objectives:[C],kpis:C.kpis,audiences:[],kpiRowValues,...o});
test('the app KPI chips and the row mapping are the workbook names',()=>{
 for(const k of [...A.kpis,...C.kpis,...P.kpis])assert.ok(k in kpiRowValues);
 const values=new Set(records.map(r=>r.primary_kpi));
 for(const v of Object.values(kpiRowValues).flat())assert.ok(values.has(v),v);
 for(const v of values)assert.ok(Object.values(kpiRowValues).flat().includes(v),`row KPI ${v} reachable from a chip`);
 assert.match(dataSrc,/Clicks: \['CTR', 'Clicks'\]/);
});
test('one recommended option per tactic: priority, then lowest cost, then record id',()=>{
 for(const market of ['UK','North America','France','Germany'])for(const o of [A,C,P]){
  const r=select(records,{market,objectives:[o],kpis:o.kpis,audiences:[],kpiRowValues});
  const tactics=r.groups.map(g=>g.tactic);assert.equal(new Set(tactics).size,tactics.length);
  for(const g of r.groups){
   const all=[g.selected,...g.alternatives];
   const best=[...all].sort((a,b)=>a.priority-b.priority||a.estimated_source_cost-b.estimated_source_cost||a.id.localeCompare(b.id))[0];
   assert.equal(g.selected.id,best.id);assert.ok(!g.alternatives.some(a=>a.id===g.selected.id));
   assert.ok(g.alternatives.every(a=>a.priority>=g.selected.priority));
  }
  assert.equal(r.selectedCount,r.groups.length);
 }
});
test('totals count the selected options only',()=>{
 const r=run({});assert.ok(r.selectedCount>0&&r.matchCount>r.selectedCount);
 assert.equal(Math.round(r.selectedCost*100),Math.round(r.groups.reduce((s,g)=>s+g.selected.estimated_source_cost,0)*100));
});
test('Clicks covers CTR and Clicks rows; a single KPI filters',()=>{
 const r=run({kpis:['Clicks']});const rows=r.groups.flatMap(g=>[g.selected,...g.alternatives]);
 assert.ok(rows.length>0&&rows.every(x=>['CTR','Clicks'].includes(x.primary_kpi)));
 assert.ok(rows.some(x=>x.primary_kpi==='CTR')&&rows.some(x=>x.primary_kpi==='Clicks'));
 const reg=run({kpis:['Registrations']}).groups.flatMap(g=>[g.selected,...g.alternatives]);
 assert.ok(reg.length>0&&reg.every(x=>x.primary_kpi==='Registrations'));
 assert.equal(run({kpis:[]}).matchCount,run({}).matchCount,'no recognised KPI means no KPI filter');
 assert.equal(run({kpis:['Audience penetration']}).matchCount,run({}).matchCount,'retired saved-plan KPI names are ignored');
});
test('KPI is checked against the objective that offers it',()=>{
 const r=select(records,{market:'UK',objectives:[A],kpis:['Impressions'],audiences:[],kpiRowValues});
 assert.ok(r.groups.flatMap(g=>[g.selected,...g.alternatives]).every(x=>x.objective==='Awareness'&&x.primary_kpi==='Impressions'));
});
test('audiences match any selected audience, never narrower than one alone',()=>{
 const one=run({audiences:['Procurement']}),two=run({audiences:['Procurement','Quality / Compliance']}),none=run({});
 for(const g of one.groups.flatMap(g=>[g.selected,...g.alternatives]))assert.equal(g.audience_fit.Procurement,true);
 for(const g of two.groups.flatMap(g=>[g.selected,...g.alternatives]))assert.ok(g.audience_fit.Procurement||g.audience_fit['Quality / Compliance']);
 assert.ok(two.matchCount>=one.matchCount&&none.matchCount>=two.matchCount);
 assert.equal(run({audiences:AUD}).matchCount,records.filter(r=>r.market==='UK'&&r.objective==='Consideration'&&r.structurally_reviewable&&AUD.some(a=>r.audience_fit[a])).length);
});
test('no market or objective returns nothing and never substitutes another',()=>{
 assert.equal(select(records,{market:'',objectives:[C],kpis:[],audiences:[],kpiRowValues}).selectedCount,0);
 assert.equal(select(records,{market:'UK',objectives:[],kpis:[],audiences:[],kpiRowValues}).selectedCount,0);
 assert.ok(run({}).groups.flatMap(g=>[g.selected,...g.alternatives]).every(x=>x.market==='UK'&&x.objective==='Consideration'));
});
