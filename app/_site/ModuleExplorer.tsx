'use client';
import {useState} from 'react';
import {GROUPS} from './content';
/** People / Performance / Growth tabs with the modules in each (WAI-ARIA tabs pattern). */
export default function ModuleExplorer(){
 const [i,setI]=useState(0);const g=GROUPS[i];
 const go=(n:number)=>{setI(n);document.getElementById('tab-'+n)?.focus()};
 const key=(e:React.KeyboardEvent)=>{if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();go((i+1)%GROUPS.length)}if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();go((i+GROUPS.length-1)%GROUPS.length)}};
 return <div className="explore">
  <div className="tabs" role="tablist" aria-label="Module groups" aria-orientation="vertical" onKeyDown={key}>
   {GROUPS.map((x,n)=><button key={x.title} id={'tab-'+n} role="tab" aria-selected={n===i} aria-controls="mod-panel" tabIndex={n===i?0:-1} onClick={()=>setI(n)}><b>{x.title}</b><span>{x.sub}</span></button>)}
  </div>
  <div className="mods" id="mod-panel" role="tabpanel" aria-labelledby={'tab-'+i}>
   {g.mods.map(m=>{const Icon=m.Icon;return <article className="mod" key={m.key}><span className="ico"><Icon size={20} aria-hidden="true"/></span><h3>{m.name}</h3><p>{m.what}</p><ul>{m.items.slice(0,4).map(x=><li key={x}>{x}</li>)}</ul></article>})}
  </div>
 </div>;
}
