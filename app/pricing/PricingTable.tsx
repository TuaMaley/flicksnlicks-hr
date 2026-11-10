'use client';
import {useState} from 'react';
import {Check,Minus} from 'lucide-react';
import type {PublicPlan} from '../_site/plans';
import {MODULE_LABELS,PUBLIC_MODULE_KEYS} from '../../lib/onboarding/constants';
const fmt=(amount:number,currency:string)=>(currency==='GHS'?'GH₵':currency==='USD'?'$':currency+' ')+amount.toLocaleString('en-GH',{minimumFractionDigits:amount%1?2:0,maximumFractionDigits:2});
export default function PricingTable({plans}:{plans:PublicPlan[]}){
 const [cycle,setCycle]=useState<'MONTHLY'|'ANNUAL'>('MONTHLY');
 const all=PUBLIC_MODULE_KEYS.length;
 const most=Math.max(...plans.map(p=>p.modules.length));
 return <>
  {plans.some(p=>p.monthlyPrice>0||p.annualPrice>0)&&<div className="toggle" role="group" aria-label="Billing period"><button type="button" aria-pressed={cycle==='MONTHLY'} onClick={()=>setCycle('MONTHLY')}>Monthly</button><button type="button" aria-pressed={cycle==='ANNUAL'} onClick={()=>setCycle('ANNUAL')}>Annual</button></div>}
  <div className="plans">{plans.map(p=>{
   const price=cycle==='MONTHLY'?p.monthlyPrice:p.annualPrice;
   const saving=cycle==='ANNUAL'&&p.monthlyPrice>0&&p.annualPrice>0&&p.annualPrice<p.monthlyPrice*12?Math.round((1-p.annualPrice/(p.monthlyPrice*12))*100):0;
   const feature=plans.length>1&&p.modules.length===most;
   return <article className={'plan'+(feature?' feature':'')} key={p.id}>
    {feature&&p.modules.length===all&&<span className="tag">Every module</span>}
    <h2>{p.name}</h2><p className="count">{p.modules.length} of {all} modules</p>
    {price>0?<><p className="price num">{fmt(price,p.currency)}<small>/{cycle==='MONTHLY'?'month':'year'}</small></p><p className="per">{saving?`Save ${saving}% compared with monthly`:cycle==='MONTHLY'?'Billed monthly':'Billed once a year'}</p></>:<><p className="price">Custom</p><p className="per">Priced for your organisation</p></>}
    <ul>{(PUBLIC_MODULE_KEYS as readonly string[]).map(k=>{const on=p.modules.includes(k);return <li key={k} className={on?'':'off'}>{on?<Check size={17} aria-hidden="true"/>:<Minus size={17} aria-hidden="true"/>}{!on&&<span className="hp">Not included: </span>}{MODULE_LABELS[k]}</li>})}</ul>
    <a className={'btn '+(feature?'btn-red':'btn-ink')} href={`/register?plan=${encodeURIComponent(p.id)}&cycle=${cycle}`}>Choose {p.name}</a>
   </article>})}</div>
 </>;
}
