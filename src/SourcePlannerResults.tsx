import {useSyncExternalStore} from 'react';
import {getRates, subscribeRates} from './fxRates';
import {FX_RATE_SOURCE, MARKETS, MARKET_CURRENCIES, OBJECTIVES, convertCurrency, formatCurrency, isCurrencyCode} from './data';
import type {Brief, FxRateSet} from './data';
import inventory from './inventory.mock.json';
import {sourceOptions} from './plannerSourceOptions';
import './SourcePlannerResults.css';
const number=(n:number)=>n.toLocaleString('en-GB',{maximumFractionDigits:2});
const basisText:Record<string,string>={
 volume:'Delivery is the package volume.',
 volume_x_rate:'Clicks or views = volume × the KPI rate. The cost is the package price.',
 package_count:'Delivery and cost are the package deliverable and package price.',
 cpl_package_100_leads:'100 leads per package. Cost = 100 × cost per lead.',
};
const calcText=(row:{calc_basis:string;raw:Record<string,string|number>})=>row.raw['Buying Model']==='CPM'?'Cost = volume ÷ 1,000 × CPM rate. Delivery is the volume (5,000 if the source has none).':basisText[row.calc_basis]||'';


// Rates come from the background load started when Compass opened (see fxRates.ts).
const useRates=():FxRateSet=>useSyncExternalStore(subscribeRates,getRates,getRates);

/** Source inspection only. Never construct a legacy allocated Plan from these rows. */
export default function SourcePlannerResults({brief}:{brief:Brief}) {
 const fx=useRates();
 const markets=MARKETS.filter(m=>brief.markets?.includes(m.id));
 const objectives=OBJECTIVES.filter(o=>brief.objectives.includes(o.id)).map(o=>o.label);
 return <section className="sp-results" aria-label="Source options">
  <p className="sp-status"><strong>Source options. No allocated plan.</strong></p>
  <div className="sp-context"><h3>Your submitted brief</h3><p>{brief.name || 'Untitled campaign'}</p><p>{brief.audiences.join(' + ')} · {brief.budget===null?'No budget':`${formatCurrency(brief.budget,'GBP')} GBP budget context`}</p><p>{brief.start} to {brief.end}</p><p>Audience matching is pending. Budget and dates are context only: no allocation, scaling or availability claim.</p></div>
  {markets.length===0&&<p role="status">Choose a market in your brief. No substitute market has been used.</p>}
  {markets.map(m=>{const result=sourceOptions(inventory.records,m.label,objectives);const marketCurrency=MARKET_CURRENCIES[m.id];const marketBudget=brief.budget===null?null:convertCurrency(brief.budget,'GBP',marketCurrency,fx.rates);return <section className="sp-market" key={m.id} aria-label={`${m.label} source options`}>
   <header><h3>{m.label}</h3><p>{objectives.join(' + ')} · {result.optionCount} source options · {marketCurrency}</p></header>
   <p className="sp-note">Each market is separate. Market versions are not additional unique packages and cannot be combined into an allocated plan. Costs are shown in {marketCurrency} and converted on the fly from the workbook currency at {FX_RATE_SOURCE}, {fx.date}{fx.live?'':' (live rates unavailable, using the saved rates from this date)'}.{marketBudget===null?'':` Budget equivalent: ${formatCurrency(marketBudget,marketCurrency)}.`}</p>
   {!result.optionCount&&<div className="sp-empty"><h4>No source options ready in this slice</h4><p>This is a data limitation, not proof that no publishers exist. No other market, objective or audience match has been substituted.</p></div>}
   {result.groups.map(g=><section className="sp-tactic" key={g.tactic}><h4>{g.tactic}</h4><p>{g.description}</p><div className="sp-options">{g.options.map(row=><article className="sp-option" key={row.id}>
    <p className="sp-publisher">{row.publisher}</p><h5>{row.product}</h5><p>{row.raw.Publication} · {row.raw.Placement}</p>
    {(()=>{const sourceCurrency=row.declared_currency||'';const marketCost=convertCurrency(row.estimated_source_cost,sourceCurrency,marketCurrency,fx.rates);const sourceCost=isCurrencyCode(sourceCurrency)?formatCurrency(row.estimated_source_cost,sourceCurrency):'unspecified currency';return <>
    <dl><div><dt>Expected delivery</dt><dd>{number(row.expected_result)} {row.forecast_unit}</dd></div><div><dt>Estimated cost · {marketCurrency}</dt><dd>{marketCost===null?'Conversion unavailable':formatCurrency(marketCost,marketCurrency)}</dd></div><div><dt>Primary KPI</dt><dd>{row.primary_kpi}{['CTR','VTR'].includes(row.primary_kpi)?` · ${number(row.raw['KPI Assumption']*100)}%`:''}</dd></div></dl>
    <details><summary>Source and assumptions</summary><p>Whole source package · {row.raw['Buying Model']} · source volume {number(row.raw['Forecast Base Volume'])}.</p><p>{calcText(row)} Existing source volume.</p><p>Source audience: {row.source_audiences.join(', ')}. Not matched to the selected roles.</p><p>Source cost: {sourceCost} {sourceCurrency&&sourceCurrency!==marketCurrency?`converted to ${marketCurrency} on the fly`:sourceCurrency===marketCurrency?'matches the market currency':'cannot be converted without a currency label'}. No publisher-specific rationale or preferred ranking has been supplied.</p><p>Workbook row {row.source_excel_row} · {row.id} · {row.raw['Source File']} · page {row.raw['Source Page']}</p></details>
    </>})()}
   </article>)}</div></section>)}
   <aside className="sp-review"><strong>{result.heldCount} source rows require review</strong><p>Unclassified tactics, missing rules and other data flags are excluded. Passing structural checks does not establish suitability.</p><a href="/data-review/issues">See data problems</a></aside>
  </section>})}
  <p className="sp-note">Source options are unranked. Nothing is preferred and no budget is spent or allocated.</p>
 </section>;
}
