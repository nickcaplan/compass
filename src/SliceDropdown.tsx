import {useEffect,useRef,useState} from 'react';
export function SliceDropdown({id,label,value,options,onChange,placeholder='Select...'}:{id:string;label:string;value:string;options:string[];onChange:(v:string)=>void;placeholder?:string}){
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
   <span>{value||placeholder}</span>
   <svg className={'ir-dd-caret'+(open?' ir-dd-open':'')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  {open&&<ul className="ir-dd-list" role="listbox" aria-labelledby={id+'-label'}>
   {options.map((o,i)=><li key={o} id={id+'-opt-'+o.replace(/\s+/g,'-')} role="option" aria-selected={o===value} className={i===active?'ir-dd-active':''} onPointerEnter={()=>setActive(i)} onClick={()=>commit(i)}>{o}</li>)}
  </ul>}
 </div>;
}
