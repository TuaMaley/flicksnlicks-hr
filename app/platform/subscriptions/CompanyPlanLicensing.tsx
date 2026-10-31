'use client';
import {useEffect,useState} from 'react';
type Company={id:string;name:string};
type Plan={id:string;name:string};
type Preview={company:Company;plan:Plan;current:string[];desired:string[];enable:string[];disable:string[]};
export default function CompanyPlanLicensing(){
 const [companies,setCompanies]=useState<Company[]>([]),[plans,setPlans]=useState<Plan[]>([]);
 const [companyId,setCompanyId]=useState(''),[planId,setPlanId]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{Promise.all([fetch('/api/platform/subscriptions',{cache:'no-store'}).then(r=>r.json()),fetch('/api/platform/plans',{cache:'no-store'}).then(r=>r.json())]).then(([a,b])=>{if(a.error||b.error)throw Error(a.error||b.error);setCompanies(a.companies||[]);setPlans(b.plans||[]);setCompanyId(a.companies?.[0]?.id||'');setPlanId(b.plans?.[0]?.id||'')}).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setPreview(null);setMessage('')},[companyId,planId]);
 async function check(){setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/platform/licensing?companyId='+encodeURIComponent(companyId)+'&planId='+encodeURIComponent(planId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Preview failed');setPreview(d)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function apply(){if(!preview||!window.confirm('Apply this module package? Modules not included in the plan will be DISABLED for this company.'))return;setBusy(true);setError('');try{const r=await fetch('/api/platform/licensing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,planId,reason,confirm:true})});const d=await r.json();if(!r.ok)throw Error(d.error||'Apply failed');setPreview(null);setMessage('Company module entitlements updated. Existing subscription dates were not changed.');setReason('')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><h2>Apply a plan's module package</h2><p>Preview changes before explicitly applying them. This changes company module entitlements, including disabling modules excluded from the plan. It does not create or renew a subscription.</p>
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{message&&<p role="status">{message}</p>}
 <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
 <label>Company <select value={companyId} onChange={e=>setCompanyId(e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Plan <select value={planId} onChange={e=>setPlanId(e.target.value)}>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <button type="button" disabled={busy||!companyId||!planId} onClick={check}>Preview module changes</button></div>
 {preview&&<div style={{marginTop:16,padding:16,border:'1px solid #ddd',borderRadius:8}}>
 <h3>Impact preview — {preview.company.name}</h3>
 <p><strong>Enable:</strong> {preview.enable.join(', ')||'None'}</p>
 <p><strong>Disable:</strong> {preview.disable.join(', ')||'None'}</p>
 <p><strong>Resulting enabled modules:</strong> {preview.desired.join(', ')||'None'}</p>
 <label style={{display:'block',marginBottom:12}}>Reason for applying (required)<input style={{display:'block',width:'100%',maxWidth:560}} value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="e.g. Approved Enterprise license allocation"/></label>
 <button type="button" disabled={busy||reason.trim().length<8} onClick={apply}>Confirm and apply module package</button>
 </div>}</section>
}
