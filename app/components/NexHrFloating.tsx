
'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import NexHrChat from './NexHrChat';
import './nexhr-floating.css';
export default function NexHrFloating(){
 const [open,setOpen]=useState(false);
 const pathname=usePathname();
 useEffect(()=>{setOpen(false)},[pathname]);
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[open]);
 return <div className="nexhr-float">
 {open&&<section className="nexhr-float-panel" role="dialog" aria-label="Nex HR assistant"><div className="nexhr-float-head"><strong>Nex HR Assistant</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close Nex HR">×</button></div><div className="nexhr-float-body nexhr-page"><NexHrChat compact/></div></section>}
 <button type="button" className="nexhr-float-launch" aria-expanded={open} aria-label={open?'Close Nex HR assistant':'Open Nex HR assistant'} onClick={()=>setOpen(v=>!v)}>{open?'×':'✦ Nex HR'}</button>
 </div>;
}
