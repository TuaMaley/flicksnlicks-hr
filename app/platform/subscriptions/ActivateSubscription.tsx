'use client';
import {useEffect,useState} from 'react';
type Item={id:string;name:string};
type ExistingSubscription={companyId:string;planName:string;status:string;startsAt:string;endsAt:string};
type Preview={company:Item;plan:Item;enable:string[];disable:string[];desired:string[]};
export default function ActivateSubscription({plansRevision=0,onActivated}:{plansRevision?:number;onActivated?:()=>void}){
 const [companies,setCompanies]=useState<Item[]>([]),[plans,setPlans]=useState<Item[]>([]);
 const [subscriptions,setSubscriptions]=useState<ExistingSubscription[]>([]);
 const [companyId,setCompanyId]=useState(''),[planId,setPlanId]=useState('');
 const [startsAt,setStartsAt]=useState(''),[endsAt,setEndsAt]=useState(''),[reason,setReason]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function refreshPlans(){
  const [sr,pr]=await Promise.all([fetch('/api/platform/subscriptions',{cache:'no-store'}),fetch('/api/platform/plans',{cache:'no-store'})]);
  const [s,p]=await Promise.all([sr.json(),pr.json()]);
  if(!sr.ok||!pr.ok)throw Error(s.error||p.error||'Unable to refresh plans');
  const activePlans:Item[]=(p.plans||[]).filter((x:{active:boolean})=>x.active);
  setCompanies((s.companies||[]).filter((c:{active?:boolean})=>c.active!==false));
  setSubscriptions(s.subscriptions||[]);
  setPlans(activePlans);
  setCompanyId(prev=>(s.companies||[]).some((c:Item)=>c.id===prev)?prev:(s.companies?.find((c:{active?:boolean})=>c.active!==false)?.id||''));
  setPreview(null);
}
useEffect(()=>{refreshPlans().catch(e=>setError(e.message))},[plansRevision]);
 useEffect(()=>{
  if(!companyId){setPlanId('');return;}
  const now=Date.now();
  const current=subscriptions.filter(s=>s.companyId===companyId&&s.status==='ACTIVE'&&Date.parse(s.startsAt)<=now&&Date.parse(s.endsAt)>now).sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt))[0];
  const matching=current?plans.find(p=>p.name.trim().toLowerCase()===current.planName.trim().toLowerCase()):undefined;
  setPlanId(matching?.id||'');
 },[companyId,subscriptions,plans]);
 useEffect(()=>{setPreview(null);setMessage('')},[companyId,planId,startsAt,endsAt]);
 async function check(){setBusy(true);setError('');try{const r=await fetch('/api/platform/activation?companyId='+encodeURIComponent(companyId)+'&planId='+encodeURIComponent(planId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Preview failed');setPreview(d)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function activate(){if(!preview||!window.confirm('Activate subscription and APPLY module package? Excluded modules will be disabled.'))return;setBusy(true);setError('');try{const r=await fetch('/api/platform/activation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,planId,startsAt,endsAt,reason,confirm:true})});const d=await r.json();if(!r.ok)throw Error(d.error||'Activation failed');setPreview(null);setMessage('Subscription activated and modules applied. Refresh the subscription list to see the new record.');setReason('');onActivated?.()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><h2>Activate subscription with module licensing</h2><p>Choose an active company and saved plan. Preview the module changes, then explicitly approve activation. This creates the subscription and applies the package together.</p>
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{message&&<p role="status">{message}</p>}
 <div style={{display:'grid',gap:12,maxWidth:560}}>
 <label>Company <select value={companyId} onChange={e=>setCompanyId(e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Subscription plan <select value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Select a plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <p style={{fontSize:12,margin:0,color:"#475569"}}>{planId?"Plan selected from the company’s current active subscription (you can change it before preview).":"No matching active subscription plan found for this company. Select a plan to continue."}</p>
 <label>Start date <input type="date" value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
 <label>Expiry date <input type="date" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" disabled={busy} onClick={()=>refreshPlans().then(()=>setMessage("Subscription plans refreshed.")).catch(e=>setError(e.message))}>Refresh plans</button><button type="button" disabled={busy||!companyId||!planId||!startsAt||!endsAt} onClick={check}>Preview activation</button></div></div>
 {preview&&<div style={{border:'1px solid #ddd',borderRadius:8,padding:16,marginTop:16}}>
 <h3>Activation impact — {preview.company.name}</h3>
 <p><strong>Enable:</strong> {preview.enable.join(', ')||'None'}</p>
 <p><strong>Disable:</strong> {preview.disable.join(', ')||'None'}</p>
 <p><strong>Resulting enabled modules:</strong> {preview.desired.join(', ')||'None'}</p>
 <label>Approval reason (required) <input style={{display:'block',width:'100%',maxWidth:560}} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Approved plan and licensing allocation"/></label>
 <button type="button" disabled={busy||reason.trim().length<8} onClick={activate}>Confirm subscription activation</button>
 </div>}
 <p style={{fontSize:12,color:'#666'}}>This workflow does not yet enforce expiry-based access restrictions or process payments. Do not activate a new overlapping subscription; cancel or complete the existing period first.</p></section>;
}
