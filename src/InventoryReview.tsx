import {useEffect,useMemo,useRef,useState} from 'react';
import source from './inventory.mock.json';
import logoUrl from './assets/thh-logo.svg';
import './InventoryReview.css';
type RecordRow=typeof source.records[number];
const inventoryCounts={total:source.records.length,reviewable:source.records.filter(r=>r.structurally_reviewable).length,production:source.records.filter(r=>r.production_eligible).length};
const assumptions=[['Demo only','All figures and market availability stay marked mock and unvalidated.'],['Review unknown tactics','Other and Other / Review combine into one review bucket, never recommendations.'],['Exact markets','Global stays separate. It is not automatic coverage of other regions.'],['No invented GBP rates','Source amounts keep their declared currency label. GBP stays blank.'],['No guessed audience match','Keep the six Compass audiences. No audience match is claimed until mapping is agreed.'],['Whole source packages','No unlimited scaling, budget allocation or preferred publisher without agreed rules.']];
function SliceDropdown({id,label,value,options,onChange}:{id:string;label:string;value:string;options:string[];onChange:(v:string)=>void}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0);
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open]);
 const selected=options.indexOf(value);
 function commit(i:number){onChange(options[i]);setOpen(false)}
 function openList(){setActive(selected>=0?selected:0);setOpen(true)}
 function onKey(e:React.KeyboardEvent){
  if(e.key==='ArrowDown'){e.preventDefault();if(!open)openList();else setActive(a=>(a+1)%options.length)}
  else if(e.key==='ArrowUp'){e.preventDefault();if(!open)openList();else setActive(a=>(a-1+options.length)%options.length)}
  else if(e.key==='Home'&&open){e.preventDefault();setActive(0)}
  else if(e.key==='End'&&open){e.preventDefault();setActive(options.length-1)}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(open)commit(active);else openList()}
  else if(e.key==='Escape'&&open){e.preventDefault();setOpen(false)}
  else if(e.key==='Tab')setOpen(false);
 }
 return <div className="ir-dd" ref={box}>
  <label className="ir-dd-label" id={id+'-label'} htmlFor={id}>{label}</label>
  <button type="button" id={id} className={'ir-dd-btn'+(value?'':' ir-dd-empty')} aria-haspopup="listbox" aria-expanded={open} aria-activedescendant={open?id+'-opt-'+options[active].replace(/\s+/g,'-'):undefined} onClick={()=>open?setOpen(false):openList()} onKeyDown={onKey}>
   <span>{value||'Select...'}</span>
   <svg className={'ir-dd-caret'+(open?' ir-dd-open':'')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  {open&&<ul className="ir-dd-list" role="listbox" aria-labelledby={id+'-label'}>
   {options.map((o,i)=><li key={o} id={id+'-opt-'+o.replace(/\s+/g,'-')} role="option" aria-selected={o===value} className={i===active?'ir-dd-active':''} onPointerEnter={()=>setActive(i)} onClick={()=>commit(i)}>{o}</li>)}
  </ul>}
 </div>;
}
export default function InventoryReview(){
 const [market,setMarket]=useState(''),[objective,setObjective]=useState(''),[theme,setTheme]=useState('dark'),[showHeld,setShowHeld]=useState(false);
 const sliceChosen=market!==''&&objective!=='';
 const matches=useMemo(()=>sliceChosen?source.records.filter(r=>r.market===market&&r.objective===objective):[],[sliceChosen,market,objective]);
 const visible=matches.filter(r=>showHeld||r.structurally_reviewable);
 const tactics=[...new Set(visible.map(r=>r.tactic))].sort();
 function cost(r:RecordRow){return r.estimated_source_cost.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
 return <div className="inventory-review" data-theme={theme}><div className="ir-wrap">
 <header className="ir-nav"><div className="ir-brand"><a className="ir-prodhome" href="/" aria-label="Compass - go to Planner"><svg className="mark" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(45 32 32)"><path className="mu" d="M32 4 L46 32 L18 32Z" /><path className="md" d="M32 60 L46 32 L18 32Z" /></g><circle className="mc" cx="32" cy="32" r="3.5" /></svg>COMPASS</a><span className="ir-byline"><span className="ir-by">by</span><a className="ir-logoLink" href="https://thehybridhouse.co.uk" target="_blank" rel="noopener noreferrer" aria-label="The Hybrid House website"><img src={logoUrl} alt="" height={26} /></a></span></div><span>Mock data review</span><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'} mode</button></header>
 <div className="ir-intro"><p className="ir-eyebrow">MOCK INVENTORY REVIEW · SEPARATE FROM THE PLANNER</p><h1>From spreadsheet<br/>to tactic-led options.</h1><p>Ben's inventory, imported with its source trail. Review the shape of the results before we agree the rules that make a recommendation.</p></div>
 <section className="ir-warning" aria-label="Data limitations"><strong>Ben's supplied mock figures. Not validated for live use.</strong><p>These figures came with Ben's workbook. Costs and results are illustrative; the five markets are simulated. THH still needs to validate rates, volumes, KPI benchmarks and availability. These are inspection options, not live publisher quotes. Nothing here changes saved plans.</p></section>
 <div className="ir-stats"><div><strong>{inventoryCounts.total.toLocaleString('en-GB')}</strong><span>records imported</span></div><div><strong>{inventoryCounts.reviewable.toLocaleString('en-GB')}</strong><span>pass structural checks only</span></div><div><strong>{inventoryCounts.production.toLocaleString('en-GB')}</strong><span>cleared for production</span></div></div>
 <div className="ir-layout"><aside className="ir-filters"><h2>Review a slice</h2><SliceDropdown id="market" label="Market" value={market} options={['UK','North America','France','Germany','Global']} onChange={setMarket}/><SliceDropdown id="objective" label="Objective" value={objective} options={['Awareness','Consideration','Performance','Review']} onChange={setObjective}/><div className="ir-missing"><strong>Audience matching pending</strong><p>The workbook's broad groups do not yet map to Compass's six job roles.</p></div><label className="ir-checkbox"><input type="checkbox" checked={showHeld} onChange={e=>setShowHeld(e.target.checked)}/> Include rows that require review</label><p className="ir-small">No budget filter: source amounts cannot safely be compared with a GBP budget yet.</p><details><summary>Six working assumptions</summary>{assumptions.map(([title,text],i)=><p key={title}><strong>{i+1}. {title}.</strong> {text}</p>)}</details></aside>
 <main className="ir-results">
 {!sliceChosen&&<div className="ir-empty ir-start"><h3>Select a market and objective</h3><p>Use the panel to choose both and the inspection options for that slice appear here.</p></div>}
 {sliceChosen&&<><div className="ir-results-head"><div><p className="ir-eyebrow">{market} · {objective}</p><h2>{visible.length} inspection {visible.length===1?'option':'options'}</h2></div><span>{matches.filter(r=>!r.structurally_reviewable).length} require review</span></div>
 {!visible.length&&<div className="ir-empty"><h3>No structurally reviewable options</h3><p>We have not substituted another market or guessed a tactic. Include rows that require review to inspect the source issues, or choose another slice.</p></div>}
 {tactics.map(tactic=><section className="ir-tactic" key={tactic}><div className="ir-tactic-header"><h3>{tactic}</h3><p>{visible.find(r=>r.tactic===tactic)?.tactic_description||'Tactic description missing. Requires review.'}</p></div><div className="ir-options">{visible.filter(r=>r.tactic===tactic).map(r=><article className="ir-option" key={r.id}><div className="ir-option-title"><div><span>{r.publisher}</span><h4>{r.product}</h4></div><span className={'ir-tag'+(r.structurally_reviewable?'':' ir-tag-review')}>{r.structurally_reviewable?'Mock option':'Requires review'}</span></div><dl><div><dt>Expected result · mock</dt><dd>{r.expected_result.toLocaleString('en-GB')} {r.forecast_unit}</dd></div><div><dt>Source cost · unverified USD label</dt><dd>{cost(r)}</dd></div></dl><p className="ir-small">No GBP quote. No audience-fit or availability claim.</p>{!!r.structural_issues.length&&<p className="ir-issues">Review: {r.structural_issues.map(i=>i.replaceAll('_',' ')).join('; ')}</p>}<details><summary>Source and assumptions</summary><p>{r.raw['Publication']} · {r.raw['Placement']}</p><p>Workbook row {r.source_excel_row} · {r.id}</p><p>{r.raw['Source File']} · page {r.raw['Source Page']}</p><p>Original audience: {r.raw['Audience Type']}</p><p>Buying model: {r.raw['Buying Model']} · source volume: {r.raw['Forecast Base Volume'].toLocaleString('en-GB')}</p><p>{r.raw['Calculation rule']}</p></details></article>)}</div></section>)}</>}
 </main></div><footer className="ir-footer">Mock inventory review · No live recommendations changed · Source workbook downloaded 12 November 2026</footer></div></div>
}
