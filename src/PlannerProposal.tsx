import {useMemo, useState} from 'react';
import inventory from './inventory.mock.json';
import {sourceOptions} from './plannerSourceOptions';
import type {SourceOption} from './plannerSourceOptions';
import logo from './assets/thh-logo.svg';
import './PlannerProposal.css';
const markets=['UK','North America','France','Germany','Global'];
const objectives=['Awareness','Consideration','Performance'];
const audiences=['Procurement','Laboratory Manager','Laboratory Technician','Scientist / Researcher','Purchasing Manager','Quality / Compliance'];
const number=(n:number)=>n.toLocaleString('en-GB',{maximumFractionDigits:2});
function Option({row}:{row:SourceOption}) {
 const rate=row.raw['KPI Assumption'];
 return <article className="pp-option">
  <div className="pp-option-top"><p>{row.publisher}</p><span>Mock source package</span></div>
  <h3>{row.product}</h3><p className="pp-publication">{row.raw.Publication} · {row.raw.Placement}</p>
  <dl className="pp-figures"><div><dt>Illustrative delivery</dt><dd><strong>{number(row.expected_result)}</strong> {row.forecast_unit}</dd></div><div><dt>Source cost · {row.declared_currency || 'currency unspecified'}</dt><dd><strong>{number(row.estimated_source_cost)}</strong></dd></div></dl>
  <p className="pp-kpi">{row.primary_kpi}{['CTR','VTR'].includes(row.primary_kpi)?` · ${number(rate*100)}%`:''} <span>/ {row.raw['Buying Model']}</span></p>
  <details><summary>Source & assumptions</summary><div className="pp-source"><p>{row.raw['Why Tactic']}</p><p>Source audience: {row.source_audiences.join(', ')}. Not matched to your chosen role.</p><p>Source volume: {number(row.raw['Forecast Base Volume'])}. {row.raw['Calculation rule']}.</p><p>Currency label retained from the demo workbook; rate and currency not validated. No GBP conversion or budget scaling.</p><p>Workbook row {row.source_excel_row} · {row.id}</p><p>{row.raw['Source File']} · page {row.raw['Source Page']}</p><p>{row.raw['Impressions / volume assumption']}</p></div></details>
 </article>;
}
export default function PlannerProposal(){
 const [market,setMarket]=useState('UK'),[objective,setObjective]=useState('Consideration'),[audience,setAudience]=useState('Laboratory Manager'),[budget,setBudget]=useState('25000'),[theme,setTheme]=useState('dark');
 const [briefOpen,setBriefOpen]=useState(()=>window.matchMedia('(min-width:761px)').matches);
 const result=useMemo(()=>sourceOptions(inventory.records,market,[objective]),[market,objective]);
 return <div className="pp" data-theme={theme}>
 <a className="pp-skip" href="#pp-results">Skip to source options</a>
 <div className="pp-wrap"><header className="pp-nav"><a className="pp-brand" href="/" aria-label="Compass - current planner"><span><svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M8 12h48L20 52l9-25z"/></svg>COMPASS</span><small>by <img src={logo} alt="The Hybrid House"/></small></a><div><span className="pp-preview">Design preview</span><button type="button" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'} mode</button></div></header>
 <main><div className="pp-hero"><p className="pp-eyebrow">RESULTS DESIGN / EXAMPLE BRIEF</p><h1>Your media options.<br/><em>Grouped by tactic.</em></h1><p>Compare the formats behind your plan. One clear explanation for each tactic, with publisher options side by side.</p></div>
 <div className="pp-notice"><strong>Illustrative design, not a recommendation.</strong> All figures and market availability are MOCK DATA - NOT VALIDATED. This example filters market and objective only. Audience fit, ranking and budget allocation are not approved.</div>
 <div className="pp-layout"><aside className="pp-brief"><details open={briefOpen} onToggle={e=>setBriefOpen(e.currentTarget.open)}><summary>Your example brief<span className="pp-brief-summary">{market} / {objective}</span></summary><div className="pp-fields">
 <label htmlFor="pp-market">Market<select id="pp-market" value={market} onChange={e=>setMarket(e.target.value)}>{markets.map(m=><option key={m}>{m}</option>)}</select></label>
 <label htmlFor="pp-objective">Objective<select id="pp-objective" value={objective} onChange={e=>setObjective(e.target.value)}>{objectives.map(o=><option key={o}>{o}</option>)}</select></label>
 <label htmlFor="pp-audience">Audience<select id="pp-audience" value={audience} onChange={e=>setAudience(e.target.value)}>{audiences.map(a=><option key={a}>{a}</option>)}</select></label>
 <p className="pp-field-note">Example only; nothing is saved. Audience matching is still to be agreed.</p>
 <label htmlFor="pp-budget">Budget context · GBP<input id="pp-budget" type="number" min="0" step="100" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
 <p className="pp-field-note">Not allocated. Source costs keep their currency; changing this amount does not scale results.</p>
 <div className="pp-open-question"><strong>What happens next?</strong><p>Agree audience mapping, package limits and scoring with THH. Then rebuild a plan from valid packages, not a multiplier.</p></div></div></details><a className="pp-current" href="/">Back to current planner <span aria-hidden="true">↗</span></a></aside>
 <section id="pp-results" className="pp-results" aria-labelledby="pp-results-title"><div className="pp-results-heading"><div><p className="pp-eyebrow">{market} / {objective}</p><h2 id="pp-results-title">Explore by tactic</h2></div><p role="status" aria-live="polite">{result.optionCount} source {result.optionCount===1?'option':'options'}<br/>{result.groups.length} tactic {result.groups.length===1?'group':'groups'}</p></div>
 <p className="pp-result-note">Source options, not an allocated plan. No preferred option or audience-fit claim. Dates and multi-market planning stay in the current planner for now.</p>
 {!!result.groups.length&&<nav className="pp-tactic-nav" aria-label="Jump to tactic">{result.groups.map((g,i)=><a key={g.tactic} href={`#pp-tactic-${i}`}>{g.tactic} <span>{g.options.length}</span></a>)}</nav>}
 {!result.optionCount&&<div className="pp-empty"><span className="pp-empty-mark" aria-hidden="true">?</span><h3>Nothing ready to show in this slice.</h3><p>That does not mean there are no publishers. The source rows here still need checking. We have not borrowed another market, guessed an audience match or made up a price.</p><button type="button" onClick={()=>{setMarket('UK');setObjective('Consideration')}}>Return to example options</button></div>}
 {result.groups.map((g,i)=><section className="pp-tactic" key={g.tactic} id={`pp-tactic-${i}`} aria-labelledby={`pp-title-${i}`}><header><span className="pp-index">{String(i+1).padStart(2,'0')}</span><div><h2 id={`pp-title-${i}`}>{g.tactic}</h2><p>{g.description}</p></div></header><div className="pp-option-grid">{g.options.map(row=><Option key={row.id} row={row}/>)}</div></section>)}
 <div className="pp-held"><strong>{result.heldCount} more source rows held for review</strong><p>Unclassified tactics, missing rules or other data flags keep these out of this design. Passing structural checks still does not establish a publisher's suitability.</p><a href="/data-review/issues">View data problems <span aria-hidden="true">↗</span></a></div>
 <section className="pp-decision"><p className="pp-eyebrow">BEFORE THIS BECOMES YOUR PLAN</p><h2>Better choices, not false certainty.</h2><p>The design is ready to discuss. Audience matching, preferred scoring, package availability and currency rules are not. No plan has been saved or changed.</p></section>
 </section></div></main><footer className="pp-footer">Compass by The Hybrid House <span>Proposal preview · Source workbook mock data</span></footer></div></div>;
}
