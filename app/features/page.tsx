import {pageMeta} from '../_site/seo';
import SiteFrame from '../_site/SiteFrame';
import {GROUPS} from '../_site/content';
import {Check,Lock,ScrollText,UsersRound,Building2,ArrowRight} from 'lucide-react';
export const metadata=pageMeta('Features | Nexora HR Management System','Employee records, leave, Ghana payroll, appraisals, recruitment, training, onboarding, disciplinary management, self-service and access controls.','/features');
export default function Features(){
 return <SiteFrame active="features">
  <section className="pagehead dark"><div className="wrap"><h1>Everything you need to run HR in Ghana</h1><p className="lede">Each plan includes a set of modules. Your administrator decides who in your company can use each one.</p>
   <div className="actions"><a className="btn btn-red" href="/pricing">Compare plans</a><a className="btn btn-line" href="/request-demo">Book a demo</a></div></div></section>
  <section className="sec"><div className="wrap">
   {GROUPS.map(g=><div className="fgroup" key={g.title} id={g.title.toLowerCase()}>
    <div className="fgroup-intro"><div><h2>{g.title}</h2><p>{g.sub}</p></div><img className="art" src={`/art/${g.title.toLowerCase()}.svg`} alt="" width={480} height={360} loading="lazy"/></div>
    {g.mods.map(m=>{const Icon=m.Icon;return <div className="frow" key={m.key}>
     <div className="t"><span className="ico"><Icon size={20} aria-hidden="true"/></span><div><h3>{m.name}</h3><p>{m.what}</p></div></div>
     <ul>{m.items.map(x=><li key={x}><Check size={16} aria-hidden="true"/>{x}</li>)}</ul>
    </div>})}
   </div>)}
  </div></section>
  <section className="sec dark"><div className="wrap">
   <div className="head"><h2>Access & Audit Controls</h2><p>Payroll and personnel data need protecting from day one. These controls decide who sees what.</p></div>
   <div className="secgrid">
    <div><span className="ico"><UsersRound size={20} aria-hidden="true"/></span><h3>Roles and permissions</h3><p>Create roles that match your organisation and grant only what each one needs.</p></div>
    <div><span className="ico"><Building2 size={20} aria-hidden="true"/></span><h3>Branch and department scopes</h3><p>Limit managers to the people they actually manage.</p></div>
    <div><span className="ico"><ScrollText size={20} aria-hidden="true"/></span><h3>Audit logs</h3><p>See sign-ins and every sensitive change, with who made it and when.</p></div>
    <div><span className="ico"><Lock size={20} aria-hidden="true"/></span><h3>Reviews and session security</h3><p>Review access on a schedule, watch failed sign-ins and sign out idle sessions.</p></div>
   </div>
   <div className="actions"><a className="btn btn-red" href="/register">Register your company <ArrowRight size={18} aria-hidden="true"/></a></div>
  </div></section>
 </SiteFrame>;
}
