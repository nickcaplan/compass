import {useEffect,useState} from 'react';
import source from './inventory.mock.json';
import logoUrl from './assets/thh-logo.svg';
import {issueLabel} from './issueLabels';
import './InventoryReview.css';
const PAGE=50;
const rows=source.records.filter(r=>r.structural_issues.length>0);
const wording:Record<string,string>={
 unclassified_tactic:'still need a tactic category',
 price_like_product_name:'have a price-like product name',
 missing_tactic_rule:'have no tactic rule',
 missing_tactic_description:'have no tactic description',
 cpl_one_unit_cost_not_campaign_budget:'use a one-unit CPL cost, not a campaign budget',
 cpm_over_1000_review_threshold:'have a CPM rate above our 1,000 review threshold',
};
const number=(n:number)=>n.toLocaleString('en-GB');
const tokens=[...new Set(rows.flatMap(r=>r.structural_issues))];
const problems=tokens.map(token=>{const affected=rows.filter(r=>r.structural_issues.includes(token));return {token,rows:affected,publishers:new Set(affected.map(r=>r.publisher)).size,sentence:`${number(affected.length)} rows ${wording[token]||`need review: ${issueLabel(token)}`}.`}}).sort((a,b)=>b.rows.length-a.rows.length);
export default function InventoryIssues(){
 const fromHash=()=>{try{return decodeURIComponent(window.location.hash.slice(1))}catch{return ''}};
 const [selected,setSelected]=useState(fromHash);
 const [theme,setTheme]=useState('dark');
 const [showCount,setShowCount]=useState(PAGE);
 const problem=problems.find(p=>p.token===selected);
 useEffect(()=>{const sync=()=>{setSelected(fromHash());setShowCount(PAGE)};window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync)}},[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{document.getElementById('problem-heading')?.focus();window.scrollTo(0,0)});return()=>cancelAnimationFrame(frame)},[selected]);
 function open(token:string){window.history.pushState(null,'',window.location.pathname+window.location.search+(token?`#${encodeURIComponent(token)}`:''));setSelected(token);setShowCount(PAGE)}
 return <div className="inventory-review" data-theme={theme}><div className="ir-wrap">
 <header className="ir-nav"><div className="ir-brand"><a className="ir-prodhome" href="/" aria-label="Compass - go to Planner"><svg className="mark" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(45 32 32)"><path className="mu" d="M32 4 L46 32 L18 32Z" /><path className="md" d="M32 60 L46 32 L18 32Z" /></g><circle className="mc" cx="32" cy="32" r="3.5" /></svg>COMPASS</a><span className="ir-byline"><span className="ir-by">by</span><a className="ir-logoLink" href="https://thehybridhouse.co.uk" target="_blank" rel="noopener noreferrer" aria-label="The Hybrid House website"><img src={logoUrl} alt="" height={26} /></a></span></div><span><a href="/data-review">Data review</a> · Data problems</span><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'} mode</button></header>
 <main className="ir-page ir-problem-page">
 {problem?<>
 <button type="button" className="ir-back-problems" onClick={()=>open('')}>← All problems</button>
 <p className="ir-eyebrow">DATA PROBLEM</p>
 <h1 id="problem-heading" tabIndex={-1}>{problem.sentence}</h1>
 <p className="ir-small">{problem.token==='cpl_one_unit_cost_not_campaign_budget'?'Known demo limitation: these are one-lead costs, not full campaign budgets.':problem.token==='cpm_over_1000_review_threshold'?'Our chosen threshold flags rates to check; it does not mean they are wrong.':problem.token==='unclassified_tactic'?'These rows are labelled Other or Other / Review, rather than a usable tactic category.':'These are review flags, not confirmed errors.'}</p>
 <p className="ir-small" role="status">Across {problem.publishers} {problem.publishers===1?'publisher':'publishers'} · Showing {Math.min(showCount,problem.rows.length)} of {number(problem.rows.length)} rows</p>
 <div className="ir-problem-table">
 <div className="ir-problem-head" aria-hidden="true"><span>Publisher</span><span>Product</span><span>Market</span><span>Tactic</span></div>
 {problem.rows.slice(0,showCount).map(r=><article className="ir-problem-row" key={r.id}>
 <h2>{r.publisher}</h2><span><small>Product</small>{r.product}</span><span><small>Market</small>{r.market}</span><span><small>Tactic</small>{r.tactic}</span>
 <p className="ir-problem-evidence">
 {problem.token==='unclassified_tactic'&&<>Source tactic: {r.raw['Tactic']}. </>}
 {problem.token==='price_like_product_name'&&<>Source product name: "{r.raw['Product / Format']}". </>}
 {problem.token==='missing_tactic_rule'&&<>No matching entry for {r.tactic} in Tactic Rules. </>}
 {problem.token==='missing_tactic_description'&&<>No matching entry for {r.tactic} in Tactic Descriptions. </>}
 {(problem.token==='cpl_one_unit_cost_not_campaign_budget'||problem.token==='cpm_over_1000_review_threshold')&&<>Buying model: {r.raw['Buying Model']} · Rate: {number(r.raw['Cost / Rate'])} {r.declared_currency}{r.raw['Buying Model']==='CPM'?' per 1,000 impressions':' per lead'} · Estimated source cost: {number(r.estimated_source_cost)} {r.declared_currency}. {r.raw['Calculation rule']}. </>}
 Source inventory row {r.raw['Source Excel Row']} · {r.raw['Source File']} · page {r.raw['Source Page']}. MOCK DATA - NOT VALIDATED.
 </p>
 </article>)}
 </div>
 {problem.rows.length>showCount&&<button type="button" className="ir-more" onClick={()=>setShowCount(c=>c+PAGE)}>Show {Math.min(PAGE,problem.rows.length-showCount)} more rows</button>}
 </>:<>
 <p className="ir-eyebrow">INVENTORY REVIEW</p>
 <h1 id="problem-heading" tabIndex={-1}>Data problems</h1>
 <p className="ir-lede">{number(rows.length)} of {number(source.records.length)} imported rows need review. Choose a problem to see the affected rows.</p>
 <p className="ir-small">Rows include market versions. Review flags and known demo limitations can overlap. All figures are mock, not validated.</p>
 {problems.length===0?<p className="ir-empty">No data problems found.</p>:<div className="ir-problem-list">{problems.map(p=><button type="button" className="ir-problem" key={p.token} onClick={()=>open(p.token)}>
 <span><strong>{p.sentence}</strong><small>Across {p.publishers} {p.publishers===1?'publisher':'publishers'}</small></span><span className="ir-problem-action">See rows <span aria-hidden="true">→</span></span>
 </button>)}</div>}
 </>}
 </main><footer className="ir-footer">Fix these problems in the source workbook. No data is changed here.<br/>Source data received 12 November 2026</footer></div></div>;
}
