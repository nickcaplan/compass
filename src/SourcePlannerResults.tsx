import {MARKETS, OBJECTIVES, KPI_ROW_VALUES, usd} from './data';
import type {Brief} from './data';
import inventory from './inventory.mock.json';
import {selectSourceOptions} from './plannerSourceOptions';
import type {SourceOption} from './plannerSourceOptions';
import './SourcePlannerResults.css';
const number=(n:number)=>n.toLocaleString('en-GB',{maximumFractionDigits:2});
const basisText:Record<string,string>={
 volume:'Delivery is the package volume.',
 volume_x_rate:'Clicks or views = volume × the KPI rate. The cost is the package price.',
 package_count:'Delivery and cost are the package deliverable and package price.',
 cpl_package_100_leads:'100 leads per package. Cost = 100 × cost per lead.',
};
const calcText=(row:{calc_basis:string;raw:Record<string,string|number>})=>row.raw['Buying Model']==='CPM'?'Cost = volume ÷ 1,000 × CPM rate. Delivery is the volume (5,000 if the source has none).':basisText[row.calc_basis]||'';


function OptionCard({row,recommended}:{row:SourceOption;recommended?:boolean}) {
 return <article className={`sp-option${recommended?' sp-selected':''}`}>
  {recommended&&<p className="sp-badge">Recommended option</p>}
  <p className="sp-publisher">{row.publisher}</p><h5>{row.product}</h5><p>{[row.raw.Publication,row.placement].filter(Boolean).join(' · ')}</p>
  <dl><div><dt>Expected delivery</dt><dd>{number(row.expected_result)} {row.forecast_unit}</dd></div><div><dt>Estimated cost · USD</dt><dd>{usd(row.estimated_source_cost)}</dd></div><div><dt>Primary KPI</dt><dd>{row.primary_kpi}{['CTR','VTR'].includes(row.primary_kpi)?` · ${number((row.raw['KPI Assumption'] as number)*100)}%`:''}</dd></div></dl>
  <details><summary>Source and assumptions</summary><p>Whole source package · {row.raw['Buying Model']} · source volume {number(row.raw['Forecast Base Volume'] as number)}.</p><p>{calcText(row)}</p><p>Priority {row.priority} of 5 (source mock score). Source audience: {row.source_audiences.join(', ')}.</p><p>Workbook row {row.source_excel_row} · {row.id} · {row.raw['Source File']} · page {row.source_page}</p></details>
 </article>;
}

/** Source inspection only. Never construct a legacy allocated Plan from these rows. */
export default function SourcePlannerResults({brief}:{brief:Brief}) {
 const markets=MARKETS.filter(m=>brief.markets?.includes(m.id));
 const objectives=OBJECTIVES.filter(o=>brief.objectives.includes(o.id));
 return <section className="sp-results" aria-label="Source options">
  <p className="sp-status"><strong>Source options. No allocated plan.</strong></p>
  <div className="sp-context"><h3>Your submitted brief</h3><p>{brief.name || 'Untitled campaign'}</p><p>{brief.audiences.join(' or ')} · {brief.budget===null?'No budget':`${usd(brief.budget)} budget context`}</p><p>{brief.start} to {brief.end}</p><p>Options suit any of the audiences you chose. Budget and dates are context only: no allocation, scaling or availability claim.</p></div>
  {markets.length===0&&<p role="status">Choose a market in your brief. No substitute market has been used.</p>}
  {markets.map(m=>{const result=selectSourceOptions(inventory.records,{market:m.label,objectives:objectives.map(o=>({label:o.label,kpis:o.kpis})),kpis:brief.kpis,audiences:brief.audiences,kpiRowValues:KPI_ROW_VALUES});return <section className="sp-market" key={m.id} aria-label={`${m.label} source options`}>
   <header><h3>{m.label}</h3><p>{objectives.map(o=>o.label).join(' + ')} · {result.selectedCount} recommended, one per tactic · {result.matchCount-result.selectedCount} alternatives · USD</p></header>
   <p className="sp-note">Each market is separate. Market versions are not additional unique packages and cannot be combined into an allocated plan. All costs are in US dollars. One option per tactic is recommended: priority 1 first, then lowest cost.</p>
   {!result.selectedCount&&<div className="sp-empty"><h4>No source options match this brief</h4><p>Try another KPI or audience. This is a data limitation, not proof that no publishers exist. No other market or objective has been substituted.</p></div>}
   {result.selectedCount>0&&<p className="sp-total"><strong>Recommended options total {usd(result.selectedCost)}</strong> across {result.selectedCount} tactics. Alternatives are not counted.</p>}
   {result.groups.map(g=><section className="sp-tactic" key={g.tactic}><h4>{g.tactic}</h4><p>{g.description}</p><div className="sp-options"><OptionCard row={g.selected} recommended/></div>{g.alternatives.length>0&&<details className="sp-alts"><summary>{g.alternatives.length} alternative{g.alternatives.length===1?'':'s'}</summary><div className="sp-options">{g.alternatives.map(a=><OptionCard key={a.id} row={a}/>)}</div></details>}</section>)}
  </section>})}
 </section>;
}
