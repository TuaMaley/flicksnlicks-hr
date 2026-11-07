'use client';
import {useEffect,useState} from 'react';
type Plan={id:string;name:string;monthlyPrice:number;annualPrice:number;currency:string;moduleKeys:string[];active:boolean};
type Company={id:string;name:string;modules:{moduleKey:string;enabled:boolean}[]};
export default function PlanCatalog({onPlansChanged}:{onPlansChanged?:()=>void}){
 const [plans,setPlans]=useState<Plan[]>([]),[companies,setCompanies]=useState<Company[]>([]);
 const [planId,setPlanId]=useState(''),[companyId,setCompanyId]=useState('');
 const [monthly,setMonthly]=useState('0'),[currency,setCurrency]=useState('GHS');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const plan=plans.find(p=>p.id===planId),company=companies.find(c=>c.id===companyId);
 const included=company?company.modules.filter(m=>m.enabled).map(m=>m.moduleKey).sort():[];
 const annual=Number.isFinite(Number(monthly))?Math.round(Number(monthly)*1200)/100:0;
 async function load(){const [pr,cr]=await Promise.all([fetch('/api/platform/plans',{cache:'no-store'}),fetch('/api/platform',{cache:'no-store'})]);const [pd,cd]=await Promise.all([pr.json(),cr.json()]);if(!pr.ok)throw Error(pd.error||'Unable to load plans');if(!cr.ok)throw Error(cd.error||'Unable to load company entitlements');setPlans(pd.plans||[]);setCompanies(cd.companies||[])}
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 function selectPlan(id:string){setPlanId(id);const p=plans.find(x=>x.id===id);if(p){setMonthly(String(p.monthlyPrice));setCurrency(p.currency)}setNotice('');setError('')}
 async function save(e:React.FormEvent){e.preventDefault();if(!plan)return;setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/platform/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:plan.id,monthlyPrice:Number(monthly),currency})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to save pricing');await load();onPlansChanged?.();setNotice('Pricing updated. Module entitlements were not changed.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><h2>Plan pricing & included modules</h2><p>Plan pricing is managed here. Company module entitlements are managed exclusively in the Modules tab.</p>{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form onSubmit={save} style={{display:'grid',gap:14,maxWidth:620}}><label>Plan name<br/><select required value={planId} onChange={e=>selectPlan(e.target.value)}><option value="">Select an existing plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Company (module entitlement preview)<br/><select value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Select company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Currency<br/><select value={currency} onChange={e=>setCurrency(e.target.value)}><option>GHS</option><option>USD</option></select></label>
 <label>Monthly price<br/><input type="number" min="0" max="999999999" step="0.01" required value={monthly} onChange={e=>setMonthly(e.target.value)}/></label>
 <label>Annual price (automatically calculated: monthly × 12)<br/><input readOnly aria-readonly="true" value={annual.toFixed(2)}/></label>
 <strong>Included modules — read only</strong>{company?<div style={{display:'flex',flexWrap:'wrap',gap:10}}>{included.length?included.map(k=><span key={k} style={{border:'1px solid #cbd5e1',borderRadius:8,padding:'6px 10px'}}>✓ {k}</span>):<span>No enabled modules for this company.</span>}</div>:<p style={{color:'#64748b'}}>Select a company to see its enabled modules. They cannot be changed here.</p>}
 <p style={{fontSize:13,color:'#64748b'}}>Company entitlements shown above are a preview and are not overwritten when pricing is saved. Pricing belongs to the selected shared plan.</p><button disabled={busy||!planId} className="primaryBtn">{busy?'Saving…':'Update plan pricing'}</button></form>
 <h3>Saved plan catalog</h3><div className="tableWrap"><table className="dataTable"><thead><tr><th>Plan</th><th>Monthly</th><th>Annual</th><th>Plan catalog modules</th><th></th></tr></thead><tbody>{plans.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.currency} {p.monthlyPrice.toFixed(2)}</td><td>{p.currency} {p.annualPrice.toFixed(2)}</td><td>{p.moduleKeys.join(', ')||'None'}</td><td><button type="button" onClick={()=>selectPlan(p.id)}>Edit pricing</button></td></tr>)}</tbody></table></div></section>
}
