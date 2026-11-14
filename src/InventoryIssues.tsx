import {useMemo,useState} from 'react';
import source from './inventory.mock.json';
import logoUrl from './assets/thh-logo.svg';
import {SliceDropdown} from './SliceDropdown';
import {issueLabel} from './issueLabels';
import './InventoryReview.css';
const PAGE=50;
const rows=source.records.filter(r=>r.structural_issues.length>0);
const issueCounts=new Map<string,number>();
for(const r of rows)for(const i of r.structural_issues)issueCounts.set(i,(issueCounts.get(i)||0)+1);
const sortedIssues=[...issueCounts.entries()].sort((a,b)=>b[1]-a[1]);
const issueList=sortedIssues.map(([token,count])=>({token,label:`${issueLabel(token)} - ${count.toLocaleString('en-GB')}`}));
const issueOptions=['All',...issueList.map(x=>x.label)];
const markets=[...new Set(rows.map(r=>r.market))].sort();
const tactics=[...new Set(rows.map(r=>r.tactic))].sort();
export default function InventoryIssues(){
 const [issueToken,setIssueToken]=useState(''),[market,setMarket]=useState(''),[tactic,setTactic]=useState('');
 const [theme,setTheme]=useState('dark');
 const [showCount,setShowCount]=useState(PAGE);
 const pickIssue=(v:string)=>{setIssueToken(issueList.find(x=>x.label===v)?.token||'');setShowCount(PAGE)};
 const pickMarket=(v:string)=>{setMarket(v==='All'?'':v);setShowCount(PAGE)};
 const pickTactic=(v:string)=>{setTactic(v==='All'?'':v);setShowCount(PAGE)};
 const issue=issueList.find(x=>x.token===issueToken)?.label||'';
 const visible=useMemo(()=>rows.filter(r=>(!issueToken||r.structural_issues.includes(issueToken))&&(!market||r.market===market)&&(!tactic||r.tactic===tactic)),[issueToken,market,tactic]);
 const shown=visible.slice(0,showCount);
 return <div className="inventory-review" data-theme={theme}><div className="ir-wrap">
 <header className="ir-nav"><div className="ir-brand"><a className="ir-prodhome" href="/" aria-label="Compass - go to Planner"><svg className="mark" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(45 32 32)"><path className="mu" d="M32 4 L46 32 L18 32Z" /><path className="md" d="M32 60 L46 32 L18 32Z" /></g><circle className="mc" cx="32" cy="32" r="3.5" /></svg>COMPASS</a><span className="ir-byline"><span className="ir-by">by</span><a className="ir-logoLink" href="https://thehybridhouse.co.uk" target="_blank" rel="noopener noreferrer" aria-label="The Hybrid House website"><img src={logoUrl} alt="" height={26} /></a></span></div><span><a href="/data-review">Mock data review</a> · Rows that require review</span><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'} mode</button></header>
 <main className="ir-page">
 <p className="ir-eyebrow">MOCK INVENTORY REVIEW</p>
 <h1>Rows that require review</h1>
 <p className="ir-lede">{rows.length.toLocaleString('en-GB')} of {source.records.length.toLocaleString('en-GB')} imported rows carry at least one data issue. Nothing here is a recommendation; this page exists so the source problems can be worked through and fixed at the workbook.</p>
 <div className="ir-issues-filterbar">
  <SliceDropdown id="f-issue" label="Issue" value={issue} options={issueOptions} onChange={pickIssue} placeholder="All"/>
  <SliceDropdown id="f-market" label="Market" value={market} options={['All',...markets]} onChange={pickMarket} placeholder="All"/>
  <SliceDropdown id="f-tactic" label="Tactic" value={tactic} options={['All',...tactics]} onChange={pickTactic} placeholder="All"/>
 </div>
 <p className="ir-small">{visible.length.toLocaleString('en-GB')} rows{visible.length>shown.length?` - first ${shown.length.toLocaleString('en-GB')} shown`:''}</p>
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
 </main><footer className="ir-footer">Mock inventory review · No live recommendations changed · Source workbook downloaded 12 November 2026</footer></div></div>;
}
