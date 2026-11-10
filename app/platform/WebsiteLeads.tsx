'use client';
// Phase 17 — demo requests and contact messages from the public website.
import {Fragment,useCallback,useEffect,useState} from 'react';
type Lead={id:string;kind:'DEMO'|'CONTACT';status:string;name:string;email:string;phone:string|null;companyName:string|null;jobTitle:string|null;country:string|null;employeeBand:string|null;topic:string|null;message:string|null;preferredTime:string|null;internalNote:string|null;createdAt:string};
const STATUSES=['NEW','CONTACTED','QUALIFIED','CLOSED'];
const label=(s:string)=>s.charAt(0)+s.slice(1).toLowerCase();
const fmt=(d:string)=>new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
export default function WebsiteLeads(){
 const [kind,setKind]=useState(''),[status,setStatus]=useState('NEW'),[leads,setLeads]=useState<Lead[]>([]),[open,setOpen]=useState<string|null>(null);
 const [draft,setDraft]=useState({status:'NEW',internalNote:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{const p=new URLSearchParams();if(kind)p.set('kind',kind);if(status)p.set('status',status);const r=await fetch('/api/platform/leads?'+p,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load leads');setLeads(d.leads)},[kind,status]);
 useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
 async function save(id:string){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/platform/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...draft})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to update');setNotice('Lead updated');setOpen(null);await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="workCard nxreg" style={{padding:22}}>
  <style>{`.nxreg input:not([type=checkbox]):not([type=radio]),.nxreg select,.nxreg textarea{padding:9px 10px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;font-size:14px;background:#fff;color:#0f172a;min-height:38px;box-sizing:border-box}.nxreg input:focus,.nxreg select:focus,.nxreg textarea:focus{outline:2px solid #c8102e;outline-offset:1px}.nxreg h4{margin:22px 0 10px}`}</style>
  <h2 style={{marginTop:0}}>Website Leads</h2>
  <p style={{marginTop:4,color:'#475569'}}>Demo requests and contact-form messages from the public website. Set NEXORA_ONBOARDING_NOTIFY_EMAIL to also receive each one by email.</p>
  {error&&<div className="formError" role="alert">{error}</div>}{notice&&<div className="successNotice" role="status">{notice}</div>}
  <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'}}>
   <select aria-label="Lead type" value={kind} onChange={e=>setKind(e.target.value)}><option value="">Demo requests and messages</option><option value="DEMO">Demo requests</option><option value="CONTACT">Contact messages</option></select>
   <select aria-label="Lead status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Any status</option>{STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select>
  </div>
  <div className="tableWrap"><table className="dataTable"><thead><tr><th>Received</th><th>Type</th><th>From</th><th>Company</th><th>Status</th><th/></tr></thead><tbody>
   {leads.map(l=><Fragment key={l.id}><tr><td>{fmt(l.createdAt)}</td><td>{l.kind==='DEMO'?'Demo request':`Message${l.topic?` · ${l.topic}`:''}`}</td><td>{l.name}<br/><small><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone?` · ${l.phone}`:''}</small></td><td>{l.companyName||'—'}{l.employeeBand&&<><br/><small>{l.employeeBand} staff{l.country?` · ${l.country}`:''}</small></>}</td><td>{label(l.status)}</td><td><button type="button" className="outlineBtn" onClick={()=>{setOpen(open===l.id?null:l.id);setDraft({status:l.status,internalNote:l.internalNote||''})}}>{open===l.id?'Close':'Open'}</button></td></tr>
    {open===l.id&&<tr><td colSpan={6} style={{background:'#f8fafc'}}>
     {l.jobTitle&&<p style={{margin:'4px 0'}}><b>Role:</b> {l.jobTitle}</p>}{l.preferredTime&&<p style={{margin:'4px 0'}}><b>Preferred time:</b> {l.preferredTime}</p>}
     {l.message&&<p style={{whiteSpace:'pre-wrap',margin:'8px 0'}}>{l.message}</p>}
     <form onSubmit={e=>{e.preventDefault();void save(l.id)}} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end',marginTop:10}}>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Status<select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}>{STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600,flex:'1 1 300px'}}>Internal note<input maxLength={1000} value={draft.internalNote} onChange={e=>setDraft(d=>({...d,internalNote:e.target.value}))}/></label>
      <button className="primaryBtn" disabled={busy}>Save</button>
     </form>
    </td></tr>}</Fragment>)}
   {!leads.length&&<tr><td colSpan={6}>No leads match this filter.</td></tr>}
  </tbody></table></div>
 </section>;
}
