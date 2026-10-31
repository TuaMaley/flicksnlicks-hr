'use client';
import {useEffect,useState} from 'react';
type Sub={id:string;companyId:string;planName:string;startsAt:string;endsAt:string;status:string;company:{name:string}};
type Plan={id:string;name:string;active:boolean};
export default function SubscriptionLifecycle({subscriptions,onUpdated}:{subscriptions:Sub[];onUpdated:()=>Promise<void>}){
 const [plans,setPlans]=useState<Plan[]>([]),[selected,setSelected]=useState(''),[mode,setMode]=useState<'RENEW'|'CHANGE'>('RENEW'),[endDate,setEndDate]=useState(''),[planId,setPlanId]=useState(''),[reason,setReason]=useState(''),[preview,setPreview]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/platform/plans',{cache:'no-store'}).then(r=>r.json()).then(d=>setPlans(d.plans||[])).catch(()=>{})},[]);
 const active=subscriptions.filter(s=>s.status==='ACTIVE');
 const sub=active.find(s=>s.id===selected);
 useEffect(()=>{if(!active.some(s=>s.id===selected))setSelected(active[0]?.id||'')},[subscriptions,selected]);
 useEffect(()=>{setPreview(null);setError('');setNotice('')},[selected,mode,planId,endDate]);
 async function check(){
 if(!sub)return;setBusy(true);setError('');
 try{const r=await fetch('/api/platform/subscription-lifecycle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'PREVIEW',subscriptionId:sub.id,mode,endDate,planId})});const d=await r.json();if(!r.ok)throw Error(d.error||'Preview failed');setPreview(d)}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function apply(){
 if(!sub||!preview||!window.confirm('Confirm this subscription change? Plan changes may DISABLE modules excluded from the new plan.'))return;
 setBusy(true);setError('');
 try{const r=await fetch('/api/platform/subscription-lifecycle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'APPLY',subscriptionId:sub.id,mode,endDate,planId,reason,confirm:true})});const d=await r.json();if(!r.ok)throw Error(d.error||'Update failed');setPreview(null);setReason('');setNotice('Subscription updated successfully.');await onUpdated()}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><h2>Renew or change an existing subscription</h2><p>Manage an active subscription without creating a duplicate overlapping record. Preview before saving.</p>{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 <div style={{display:'grid',gap:12,maxWidth:600}}>
 <label>Existing subscription <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select subscription</option>{active.map(s=><option key={s.id} value={s.id}>{s.company.name} — {s.planName} ({s.endsAt.slice(0,10)})</option>)}</select></label>
 <label>Action <select value={mode} onChange={e=>setMode(e.target.value as 'RENEW'|'CHANGE')}><option value="RENEW">Extend expiry date</option><option value="CHANGE">Upgrade / downgrade plan</option></select></label>
 {mode==='RENEW'?<label>New expiry date <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>:<label>New plan <select value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Select new plan</option>{plans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 <button type="button" disabled={busy||!sub||(mode==='RENEW'?!endDate:!planId)} onClick={check}>Preview change</button></div>
 {preview&&<div style={{border:'1px solid #ddd',borderRadius:8,padding:16,marginTop:16}}><h3>Change preview</h3>
 <p>{mode==='RENEW'?`Expiry: ${preview.previousEndDate} → ${preview.newEndDate}`:`Plan: ${preview.oldPlan} → ${preview.newPlan}`}</p>
 {mode==='CHANGE'&&<><p><strong>Enable:</strong> {preview.enable.join(', ')||'None'}</p><p><strong>Disable:</strong> {preview.disable.join(', ')||'None'}</p></>}
 <label>Reason (8+ characters) <input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} style={{display:'block',width:'100%',maxWidth:600}}/></label>
 <button type="button" disabled={busy||reason.trim().length<8} onClick={apply}>Confirm change</button></div>}
 <p style={{fontSize:12,color:'#666'}}>Renewal extends the current record; changing plans updates its name and company module entitlements. Billing, proration and automatic expiry enforcement are not implemented.</p></section>
}
