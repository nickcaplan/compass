import {useMemo,useState} from 'react';
import source from './inventory.mock.json';
import logoUrl from './assets/thh-logo.svg';
import {issueLabel} from './issueLabels';
import './InventoryReview.css';
const PAGE=50;
const rows=source.records.filter(r=>r.structural_issues.length>0);
type Row=typeof rows[number];
const dimensions=[['issue','Issue'],['publisher','Publisher'],['market','Market'],['tactic','Tactic'],['format','Product / format']] as const;
type Dimension=typeof dimensions[number][0];
type Selection=Partial<Record<Dimension,string>>;
const formatKey=(r:Row)=>`${r.source_sheet}:${r.raw['Source Excel Row']}`;
function valueFor(r:Row,d:Dimension):string[]{return d==='issue'?r.structural_issues:[d==='format'?formatKey(r):r[d]]}
function groupLabel(d:Dimension,v:string):string{
 if(d==='issue')return issueLabel(v);
 if(d==='format'){const r=rows.find(r=>formatKey(r)===v);return r?`${r.publisher} - ${r.product} (source format ${r.raw['Source Excel Row']})`:v}
 return v;
}
const number=(n:number)=>n.toLocaleString('en-GB');
export default function InventoryIssues(){
 const [selection,setSelection]=useState<Selection>({});
 const [dimension,setDimension]=useState<Dimension>('issue');
 const [view,setView]=useState<'groups'|'rows'>('groups');
 const [search,setSearch]=useState('');
 const [theme,setTheme]=useState('dark');
 const [showCount,setShowCount]=useState(PAGE);
 const visible=useMemo(()=>rows.filter(r=>dimensions.every(([d])=>!selection[d]||valueFor(r,d).includes(selection[d]!))),[selection]);
 const groups=useMemo(()=>{
  const counts=new Map<string,number>();
  for(const r of visible)for(const v of valueFor(r,dimension))counts.set(v,(counts.get(v)||0)+1);
  return [...counts].map(([value,count])=>({value,count,label:groupLabel(dimension,value)})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 },[visible,dimension]);
 const searchedGroups=groups.filter(g=>g.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const shown=visible.slice(0,showCount);
 const shownGroups=searchedGroups.slice(0,showCount);
 const formats=new Set(visible.map(formatKey)).size;
 function resetReveal(){setShowCount(PAGE);setSearch('')}
 function remove(d:Dimension){setSelection(s=>{const next={...s};delete next[d];return next});resetReveal()}
 return <div className="inventory-review" data-theme={theme}><div className="ir-wrap">
 <header className="ir-nav"><div className="ir-brand"><a className="ir-prodhome" href="/" aria-label="Compass - go to Planner"><svg className="mark" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(45 32 32)"><path className="mu" d="M32 4 L46 32 L18 32Z" /><path className="md" d="M32 60 L46 32 L18 32Z" /></g><circle className="mc" cx="32" cy="32" r="3.5" /></svg>COMPASS</a><span className="ir-byline"><span className="ir-by">by</span><a className="ir-logoLink" href="https://thehybridhouse.co.uk" target="_blank" rel="noopener noreferrer" aria-label="The Hybrid House website"><img src={logoUrl} alt="" height={26} /></a></span></div><span><a href="/data-review">Data review</a> · Rows that require review</span><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'} mode</button></header>
 <main className="ir-page">
 <p className="ir-eyebrow">INVENTORY REVIEW</p>
 <h1>Rows that require review</h1>
 <p className="ir-lede">{rows.length.toLocaleString('en-GB')} of {source.records.length.toLocaleString('en-GB')} imported rows carry at least one data issue. Nothing here is a recommendation; this page exists so the source problems can be worked through and fixed at the workbook.</p>
 <section className="ir-explorer" aria-label="Explore inventory issues">
 <p className="ir-explorer-total" role="status" aria-live="polite" aria-atomic="true"><strong>{number(visible.length)} matching {visible.length===1?'row':'rows'}</strong><span>{number(formats)} source {formats===1?'format':'formats'} · Rows include market versions</span></p>
 <div className="ir-explorer-scope" aria-label="Active filters">
 {dimensions.filter(([d])=>selection[d]).map(([d,label])=><button type="button" className="ir-filter-chip" key={d} onClick={()=>remove(d)} aria-label={`Remove ${label} filter: ${groupLabel(d,selection[d]!)}`}>{label}: {groupLabel(d,selection[d]!)}<span aria-hidden="true"> ×</span></button>)}
 {Object.keys(selection).length>0?<button type="button" className="ir-clear-filters" onClick={()=>{setSelection({});resetReveal()}}>Clear all</button>:<span className="ir-small">All rows requiring review</span>}
 </div>
 <div className="ir-explorer-toolbar">
 <div className="ir-view-switch" role="group" aria-label="Result view"><button type="button" aria-pressed={view==='groups'} onClick={()=>{setView('groups');resetReveal()}}>Groups</button><button type="button" aria-pressed={view==='rows'} onClick={()=>{setView('rows');resetReveal()}}>Rows</button></div>
 {view==='groups'&&<div className="ir-explore-by"><label htmlFor="explore-by">Explore by</label><select id="explore-by" value={dimension} onChange={e=>{setDimension(e.target.value as Dimension);resetReveal()}}>{dimensions.map(([d,label])=><option key={d} value={d}>{label}</option>)}</select></div>}
 </div>
 {view==='groups'&&<>
 <p className="ir-small">Choose a group to filter, then explore another dimension or switch to Rows. Empty groups are hidden.{dimension==='issue'&&' A row can have several issues, so issue counts overlap.'}</p>
 <label className="ir-group-search" htmlFor="group-search">Find a group<input id="group-search" type="search" placeholder={`Search ${dimensions.find(([d])=>d===dimension)?.[1].toLowerCase()} groups`} value={search} onChange={e=>{setSearch(e.target.value);setShowCount(PAGE)}}/></label>
 <p className="ir-small">{number(searchedGroups.length)} {searchedGroups.length===1?'group':'groups'} - {number(shownGroups.length)} shown</p>
 <div className="ir-group-list">{shownGroups.map(g=><button type="button" className="ir-data-group" key={g.value} aria-pressed={selection[dimension]===g.value} onClick={()=>{setSelection(s=>({...s,[dimension]:g.value}));resetReveal()}}><span>{g.label}</span><strong>{number(g.count)} {g.count===1?'row':'rows'}</strong><span className="ir-group-action">{selection[dimension]===g.value?'Selected':'Explore'}<span aria-hidden="true"> →</span></span></button>)}</div>
 {searchedGroups.length===0&&<p className="ir-empty">No groups match this search. Clear the search or remove a filter to widen the results.</p>}
 {searchedGroups.length>shownGroups.length&&<button type="button" className="ir-more" onClick={()=>setShowCount(c=>c+PAGE)}>Show more groups - {number(searchedGroups.length-shownGroups.length)} left</button>}
 </>}
 </section>
 {view==='rows'&&<>
 <p className="ir-small ir-issues-count">{number(visible.length)} matching {visible.length===1?'row':'rows'} - {number(shown.length)} shown</p>
 {visible.length===0&&<p className="ir-empty">No rows match these filters. Remove a filter or choose Clear all to widen the results.</p>}
 <div className="ir-ihead" aria-hidden="true"><span>Publisher / Product</span><span>Tactic</span><span>Market</span><span>Objective</span><span>Source cost</span><span>Issue</span></div>
 <div className="ir-irows">
 {shown.map(r=><article className="ir-irow" key={r.id}>
  <h4><span className="ir-icol">Publisher / Product</span>{r.publisher} - {r.product}</h4>
  <span className="ir-mut"><span className="ir-icol">Tactic</span>{r.tactic}</span>
  <span className="ir-mut"><span className="ir-icol">Market</span>{r.market}</span>
  <span className="ir-mut"><span className="ir-icol">Objective</span>{r.objective}</span>
  <span className="ir-mut"><span className="ir-icol">Source cost</span>{r.estimated_source_cost.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
  <p className="ir-issues"><span className="ir-icol">Issue</span>Review: {r.structural_issues.map(issueLabel).join('; ')}</p>
 </article>)}
 </div>
 {visible.length>shown.length&&<button type="button" className="ir-more" onClick={()=>setShowCount(c=>c+PAGE)}>Show more - {(visible.length-shown.length).toLocaleString('en-GB')} rows left</button>}
 </>}
 </main><footer className="ir-footer">Inventory review · Source data received 12 November 2026</footer></div></div>;
}
