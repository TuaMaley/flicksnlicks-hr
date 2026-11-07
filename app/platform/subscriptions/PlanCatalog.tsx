'use client';
import {useEffect,useState} from 'react';
type Plan={id:string;name:string;monthlyPrice:number;annualPrice:number;currency:string;moduleKeys:string[]};
type Company={id:string;name:string;modules:{moduleKey:string;enabled:boolean}[]};
type Price={id:string;companyId:string;planId:string;currency:string;monthlyPrice:number;annualPrice:number};
export function SavedPlanCatalog(){
 const [plans,setPlans]=useState<Plan[]>([]),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/platform/plans',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load catalog');setPlans(d.plans||[])}).catch(e=>setError(e.message))},[]);
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><h2>Saved plan catalog</h2><p>Master plan prices and included modules. Company-specific pricing is managed under Plan pricing.</p>{error&&<p role="alert">{error}</p>}<div className="tableWrap"><table className="dataTable"><thead><tr><th>Plan</th><th>Monthly</th><th>Annual</th><th>Included modules</th></tr></thead><tbody>{plans.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.currency} {p.monthlyPrice.toFixed(2)}</td><td>{p.currency} {p.annualPrice.toFixed(2)}</td><td>{p.moduleKeys.join(', ')||'None'}</td></tr>)}{plans.length===0&&<tr><td colSpan={4}>No plans found.</td></tr>}</tbody></table></div></section>
}
export default function PlanCatalog(){
 const [plans,setPlans]=useState<Plan[]>([]),[companies,setCompanies]=useState<Company[]>([]),[prices,setPrices]=useState<Price[]>([]);
 const [companyId,setCompanyId]=useState(''),[planId,setPlanId]=useState(''),[currency,setCurrency]=useState('GHS'),[monthly,setMonthly]=useState('0');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const company=companies.find(c=>c.id===companyId),plan=plans.find(p=>p.id===planId);
 const included=company?.modules.filter(m=>m.enabled).map(m=>m.moduleKey).sort()||[];
 const saved=prices.filter(p=>p.companyId===companyId);
 const annual=Number.isFinite(Number(monthly))?Math.round(Number(monthly)*1200)/100:0;
 async function load(){const [pr,cr,rr]=await Promise.all([fetch('/api/platform/plans',{cache:'no-store'}),fetch('/api/platform',{cache:'no-store'}),fetch('/api/platform/company-plan-prices',{cache:'no-store'})]);const [pd,cd,rd]=await Promise.all([pr.json(),cr.json(),rr.json()]);if(!pr.ok||!cr.ok||!rr.ok)throw Error(pd.error||cd.error||rd.error||'Unable to load pricing');setPlans(pd.plans||[]);setCompanies(cd.companies||[]);setPrices(rd.prices||[])}
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 function select(company:string,plan:string){setCompanyId(company);setPlanId(plan);const existing=prices.find(p=>p.companyId===company&&p.planId===plan);const catalog=plans.find(p=>p.id===plan);setCurrency(existing?.currency||catalog?.currency||'GHS');setMonthly(String(existing?.monthlyPrice??catalog?.monthlyPrice??0));setNotice('')}
 async function save(e:React.FormEvent){e.preventDefault();if(!companyId||!planId)return;setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/platform/company-plan-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,planId,currency,monthlyPrice:Number(monthly)})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to update pricing');await load();setNotice('Company plan price saved. Master catalog pricing remains unchanged.')}catch(e:any){setError(e.message||'Save failed')}finally{setBusy(false)}}
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><h2>Company plan pricing</h2><p>Set a price for a specific company and plan. Master plan catalog prices are not changed.</p>{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form onSubmit={save} style={{display:'grid',gap:14,maxWidth:620}}><label>Company name<br/><select required value={companyId} onChange={e=>select(e.target.value,planId)}><option value="">Select company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Plan type<br/><select required value={planId} onChange={e=>select(companyId,e.target.value)}><option value="">Select plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Currency<br/><select value={currency} onChange={e=>setCurrency(e.target.value)}><option>GHS</option><option>USD</option></select></label>
 <label>Monthly price<br/><input type="number" min="0" max="999999999" step="0.01" required value={monthly} onChange={e=>setMonthly(e.target.value)}/></label>
 <label>Annual price (monthly × 12)<br/><input readOnly aria-readonly="true" value={annual.toFixed(2)}/></label>
 <strong>Enabled company modules — read only</strong>{company?<div style={{display:'flex',flexWrap:'wrap',gap:8}}>{included.length?included.map(k=><span key={k} style={{padding:'6px 10px',border:'1px solid #cbd5e1',borderRadius:8}}>✓ {k}</span>):'No enabled modules'}</div>:<p>Select a company to preview enabled modules.</p>}
 <button className="primaryBtn" disabled={busy||!companyId||!planId}>{busy?'Saving…':'Update price'}</button></form>
 <h3 style={{marginTop:24}}>Saved prices for {company?.name||'selected company'}</h3><div className="tableWrap"><table className="dataTable"><thead><tr><th>Company</th><th>Plan</th><th>Currency</th><th>Monthly</th><th>Annual</th><th>Action</th></tr></thead><tbody>{saved.map(p=><tr key={p.id}><td>{company?.name}</td><td>{plans.find(x=>x.id===p.planId)?.name||'Unknown plan'}</td><td>{p.currency}</td><td>{p.monthlyPrice.toFixed(2)}</td><td>{p.annualPrice.toFixed(2)}</td><td><button type="button" onClick={()=>select(p.companyId,p.planId)}>Edit price</button></td></tr>)}{saved.length===0&&<tr><td colSpan={6}>{companyId?'No company-specific prices saved yet.':'Select a company to view its saved prices.'}</td></tr>}</tbody></table></div>
 </section>
}
