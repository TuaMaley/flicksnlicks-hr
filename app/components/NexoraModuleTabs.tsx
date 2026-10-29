'use client';
import Link from 'next/link';
import './NexoraModuleTabs.css';
export type NexoraTab<T extends string>={id:T;label:string;disabled?:boolean};
export default function NexoraModuleTabs<T extends string>({tabs,active,onChange,ariaLabel='Module sections'}:{tabs:readonly NexoraTab<T>[];active:T;onChange:(tab:T)=>void;ariaLabel?:string}){
 return <nav className="nexoraModuleTabs" aria-label={ariaLabel}>{tabs.map(t=>t.disabled?<span key={t.id} className="nexoraModuleTabUpcoming" aria-disabled="true">{t.label}</span>:<Link key={t.id} href={'?tab='+encodeURIComponent(t.id)} className={active===t.id?'nexoraModuleTabActive':''} aria-current={active===t.id?'page':undefined} onClick={e=>{e.preventDefault();window.history.replaceState(null,'','?tab='+encodeURIComponent(t.id));onChange(t.id)}}>{t.label}</Link>)}</nav>
}
