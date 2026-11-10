'use client';
// Phase 17 — Registrations: review queue for self-service sign-ups and assisted (platform-entered) onboarding.
import {useCallback,useEffect,useMemo,useState} from 'react';
import {BILLING_CYCLES,COMPANY_TYPES,EMPLOYEE_BANDS,INDUSTRIES} from '../../lib/onboarding/constants';

type Row={id:string;reference:string;source:string;status:string;companyName:string;country:string;employeeBand:string|null;adminName:string;adminEmail:string;planName:string|null;billingCycle:string;duplicateCount:number;verificationExpired:boolean;companyCode:string|null;createdAt:string};
type Plan={id:string;name:string;currency:string;monthlyPrice?:number;annualPrice?:number;moduleKeys?:unknown};
type Flag={kind:string;severity:'blocking'|'high'|'medium';detail:string};
type Detail={registration:any;duplicates:{blockedReason:string|null;flags:Flag[]}|null;suggestedCode:string|null;invitations:{id:string;email:string;createdAt:string;sentAt:string|null;expiresAt:string;acceptedAt:string|null;revokedAt:string|null}[];plans:Plan[];trail:{id:string;action:string;actor:string;detail:any;createdAt:string}[];emailConfigured:boolean};

const STATUS_LABEL:Record<string,string>={PENDING_VERIFICATION:'Awaiting email confirmation',PENDING_REVIEW:'Awaiting review',APPROVED:'Approved — invitation sent',ACTIVE:'Active',REJECTED:'Rejected',CANCELLED:'Cancelled'};
const STATUS_TONE:Record<string,string>={PENDING_VERIFICATION:'#64748b',PENDING_REVIEW:'#b45309',APPROVED:'#1d4ed8',ACTIVE:'#15803d',REJECTED:'#b91c1c',CANCELLED:'#6b7280'};
const ACTION_LABEL:Record<string,string>={REGISTRATION_SUBMITTED:'Submitted on the website',REGISTRATION_CREATED_BY_PLATFORM:'Entered by a platform administrator',REGISTRATION_VERIFICATION_SENT:'Confirmation email sent',REGISTRATION_VERIFICATION_RESENT:'Confirmation email resent',REGISTRATION_VERIFICATION_DELIVERY_FAILED:'Confirmation email failed',REGISTRATION_EMAIL_VERIFIED:'Applicant confirmed email',REGISTRATION_EMAIL_VERIFIED_MANUALLY:'Email marked verified by administrator',REGISTRATION_APPROVED:'Approved',COMPANY_WORKSPACE_PROVISIONED:'Workspace created (inactive)',ONBOARDING_INVITATION_SENT:'Administrator invitation sent',ONBOARDING_INVITATION_DELIVERY_FAILED:'Invitation email failed',ONBOARDING_INVITATION_ACCEPTED:'Administrator accepted invitation',COMPANY_ACTIVATED:'Company activated',REGISTRATION_REJECTED:'Rejected',REGISTRATION_CANCELLED:'Cancelled',REGISTRATION_NOTE_ADDED:'Note'};
const fmt=(d:string|null|undefined)=>d?new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const blank={companyName:'',companyType:'',registrationNumber:'',taxIdentifier:'',industry:'',employeeBand:'',businessAddress:'',digitalAddress:'',city:'',companyEmail:'',companyPhone:'',website:'',contactName:'',contactPosition:'',contactPhone:'',contactEmail:'',adminSameAsContact:true,adminName:'',adminEmail:'',adminPhone:'',adminJobTitle:'',planId:'',billingCycle:'MONTHLY',notes:'',approveNow:true,companyCode:'',reviewNotes:'',acknowledgeDuplicates:false};

function Badge({status}:{status:string}){return <span style={{display:'inline-block',padding:'3px 9px',borderRadius:999,fontSize:12,fontWeight:700,color:STATUS_TONE[status]||'#334155',background:'#f1f5f9',border:`1px solid ${STATUS_TONE[status]||'#cbd5e1'}33`,whiteSpace:'nowrap'}}>{STATUS_LABEL[status]||status}</span>}

export default function CompanyRegistrations(){
 const [view,setView]=useState<'queue'|'assisted'>('queue');
 const [rows,setRows]=useState<Row[]>([]),[counts,setCounts]=useState<Record<string,number>>({}),[plans,setPlans]=useState<Plan[]>([]),[emailOk,setEmailOk]=useState(true);
 const [filter,setFilter]=useState('PENDING_REVIEW'),[q,setQ]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [approve,setApprove]=useState({companyCode:'',planId:'',billingCycle:'MONTHLY',reviewNotes:'',acknowledgeDuplicates:false});
 const [reason,setReason]=useState(''),[note,setNote]=useState(''),[pending,setPending]=useState<null|'reject'|'cancel'|'markVerified'>(null),[notify,setNotify]=useState(true);
 const [form,setForm]=useState(blank),[fields,setFields]=useState<Record<string,string>>({});

 const load=useCallback(async()=>{const p=new URLSearchParams();if(filter)p.set('status',filter);if(q.trim())p.set('q',q.trim());const r=await fetch('/api/platform/registrations?'+p,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load registrations');setRows(d.registrations);setCounts(d.counts);setPlans(d.plans);setEmailOk(d.emailConfigured)},[filter,q]);
 const open=useCallback(async(id:string)=>{setSelected(id);setDetail(null);setPending(null);setReason('');setNote('');const r=await fetch('/api/platform/registrations?id='+encodeURIComponent(id),{cache:'no-store'});const d=await r.json();if(!r.ok){setError(d.error||'Unable to load registration');return}setDetail(d);setApprove({companyCode:d.suggestedCode||'',planId:d.registration.planId||'',billingCycle:d.registration.billingCycle,reviewNotes:'',acknowledgeDuplicates:false})},[]);
 useEffect(()=>{load().catch(e=>setError(e.message))},[load]);

 async function act(payload:Record<string,unknown>){setBusy(true);setError('');setNotice('');setFields({});try{const r=await fetch('/api/platform/registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok){if(d.fields)setFields(d.fields);throw Error(d.error||'Action failed')}setNotice(d.message||'Saved');await load();if(payload.action==='createAssisted'){setForm(blank);if(d.id){setView('queue');setFilter('');await open(d.id)}}else if(selected)await open(selected);setPending(null);setReason('');setNote('')}catch(e:any){setError(e.message)}finally{setBusy(false)}}

 const reg=detail?.registration;
 const highFlags=useMemo(()=>(detail?.duplicates?.flags||[]).filter(f=>f.severity==='high'),[detail]);
 const blocking=Boolean(detail?.duplicates?.blockedReason||(detail?.duplicates as any)?.businessConflict);
 const activeInvite=detail?.invitations.find(i=>!i.acceptedAt&&!i.revokedAt&&new Date(i.expiresAt)>new Date());
 const set=(k:keyof typeof blank,v:any)=>setForm(f=>({...f,[k]:v}));
 const F=({k,label,type='text',required=false,max=120}:{k:keyof typeof blank;label:string;type?:string;required?:boolean;max?:number})=><label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>{label}{required&&' *'}<input type={type} required={required} maxLength={max} value={String(form[k])} onChange={e=>set(k,e.target.value)} aria-invalid={Boolean(fields[k])}/>{fields[k]&&<small style={{color:'#b91c1c',fontWeight:500}}>{fields[k]}</small>}</label>;
 const Sel=(k:keyof typeof blank,label:string,opts:readonly string[])=><label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>{label} *<select required value={String(form[k])} onChange={e=>set(k,e.target.value)} aria-invalid={Boolean(fields[k])}><option value="">Select</option>{opts.map(o=><option key={o}>{o}</option>)}</select>{fields[k]&&<small style={{color:'#b91c1c',fontWeight:500}}>{fields[k]}</small>}</label>;

 return <section className="workCard nxreg" style={{padding:22}}>
  <style>{`.nxreg input:not([type=checkbox]):not([type=radio]),.nxreg select,.nxreg textarea{padding:9px 10px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;font-size:14px;background:#fff;color:#0f172a;min-height:38px;box-sizing:border-box}.nxreg input:focus,.nxreg select:focus,.nxreg textarea:focus{outline:2px solid #c8102e;outline-offset:1px}.nxreg h4{margin:22px 0 10px}`}</style>
  <h2 style={{marginTop:0}}>Company Registrations</h2>
  <p style={{marginTop:4,color:'#475569'}}>Companies that registered on the website, and companies you onboard on their behalf. Approving creates an inactive workspace and emails the administrator a one-time activation link; the company goes live when they set their password.</p>
  {!emailOk&&<div className="formError" role="alert">Email delivery is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL / NEXORA_APP_URL). Website registrations are paused and approvals cannot send invitations.</div>}
  <div role="tablist" aria-label="Registrations" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0 18px'}}>
   <button type="button" role="tab" aria-selected={view==='queue'} className={view==='queue'?'primaryBtn':'outlineBtn'} onClick={()=>setView('queue')}>Review queue {counts.PENDING_REVIEW?`(${counts.PENDING_REVIEW})`:''}</button>
   <button type="button" role="tab" aria-selected={view==='assisted'} className={view==='assisted'?'primaryBtn':'outlineBtn'} onClick={()=>{setView('assisted');setFields({})}}>Onboard a company for them</button>
  </div>
  {error&&<div className="formError" role="alert">{error}</div>}{notice&&<div className="successNotice" role="status">{notice}</div>}

  {view==='queue'&&<>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
    {[['PENDING_REVIEW','Awaiting review'],['PENDING_VERIFICATION','Unconfirmed'],['APPROVED','Approved'],['ACTIVE','Active'],['REJECTED','Rejected'],['CANCELLED','Cancelled'],['','All']].map(([s,l])=><button key={s||'all'} type="button" className={filter===s?'primaryBtn':'outlineBtn'} onClick={()=>setFilter(s)}>{l}{s&&counts[s]!==undefined?` · ${counts[s]}`:''}</button>)}
    <form onSubmit={e=>{e.preventDefault();load().catch(x=>setError(x.message))}} style={{display:'flex',gap:6,marginLeft:'auto'}}><input type="search" placeholder="Company, email, reference or code" aria-label="Search registrations" value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:240}}/><button className="outlineBtn">Search</button></form>
   </div>
   <div className="tableWrap"><table className="dataTable"><thead><tr><th>Received</th><th>Company</th><th>Administrator</th><th>Plan</th><th>Source</th><th>Status</th><th>Warnings</th><th/></tr></thead><tbody>
    {rows.map(r=><tr key={r.id} style={selected===r.id?{background:'#fff5f5'}:undefined}><td>{fmt(r.createdAt)}<br/><small>{r.reference}</small></td><td><b>{r.companyName}</b><br/><small>{r.country}{r.employeeBand?` · ${r.employeeBand} staff`:''}</small></td><td>{r.adminName}<br/><small>{r.adminEmail}</small></td><td>{r.planName||'—'}<br/><small>{r.billingCycle.toLowerCase()}</small></td><td>{r.source==='PLATFORM_ADMIN'?'Assisted':'Website'}</td><td><Badge status={r.status}/>{r.verificationExpired&&<><br/><small style={{color:'#b91c1c'}}>Link expired</small></>}</td><td>{r.duplicateCount?<span style={{color:'#b45309',fontWeight:700}}>{r.duplicateCount} possible duplicate{r.duplicateCount>1?'s':''}</span>:'—'}</td><td><button type="button" className="outlineBtn" onClick={()=>open(r.id)}>Review</button></td></tr>)}
    {!rows.length&&<tr><td colSpan={8}>No registrations match this filter.</td></tr>}
   </tbody></table></div>
  </>}

  {view==='queue'&&selected&&<div className="workCard" style={{padding:20,marginTop:20,border:'1px solid #e2e8f0'}}>
   {!detail&&<p>Loading registration…</p>}
   {reg&&<>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}><div><h3 style={{margin:0}}>{reg.companyName}</h3><p style={{margin:'4px 0 0',color:'#64748b'}}>{reg.reference} · {reg.source==='PLATFORM_ADMIN'?'Entered by platform administrator':'Registered on the website'} · received {fmt(reg.createdAt)}</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}><Badge status={reg.status}/><button type="button" className="outlineBtn" onClick={()=>{setSelected(null);setDetail(null)}}>Close</button></div></div>

    {detail?.duplicates&&(detail.duplicates.blockedReason||detail.duplicates.flags.length>0)&&<div role="alert" style={{margin:'16px 0',padding:14,borderRadius:8,background:'#fffbeb',border:'1px solid #f59e0b'}}>
     <b>Possible duplicates</b>
     {detail.duplicates.blockedReason&&<p style={{margin:'6px 0',color:'#b91c1c'}}>{detail.duplicates.blockedReason==='ADMIN_EMAIL_HAS_ACCOUNT'?'The administrator email already belongs to a Nexora account. This registration cannot be approved as entered.':'Another open registration uses this administrator email.'}</p>}
     <ul style={{margin:'6px 0 0',paddingLeft:18}}>{detail.duplicates.flags.map((f,i)=><li key={i} style={{color:f.severity==='medium'?'#92400e':'#b91c1c',fontWeight:f.severity==='blocking'?700:400}}>{f.severity==='blocking'?'Cannot be approved: ':''}{f.detail}</li>)}</ul>
    </div>}

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:18,marginTop:14}}>
     <dl style={{margin:0,display:'grid',gridTemplateColumns:'auto 1fr',gap:'6px 14px',fontSize:14}}>
      <dt style={{color:'#64748b'}}>Company type</dt><dd style={{margin:0}}>{reg.companyType||'—'}</dd>
      <dt style={{color:'#64748b'}}>Registration no.</dt><dd style={{margin:0}}>{reg.registrationNumber||'—'}</dd>
      <dt style={{color:'#64748b'}}>Ghana Card / TIN</dt><dd style={{margin:0}}>{reg.taxIdentifier||'—'}</dd>
      <dt style={{color:'#64748b'}}>Business address</dt><dd style={{margin:0}}>{[reg.businessAddress,reg.city].filter(Boolean).join(', ')||'—'}</dd>
      <dt style={{color:'#64748b'}}>Digital address</dt><dd style={{margin:0}}>{reg.digitalAddress||'—'}</dd>
      <dt style={{color:'#64748b'}}>Industry</dt><dd style={{margin:0}}>{reg.industry||'—'}</dd>
      <dt style={{color:'#64748b'}}>Size</dt><dd style={{margin:0}}>{reg.employeeBand?`${reg.employeeBand} employees`:'—'}</dd>
      <dt style={{color:'#64748b'}}>Company email</dt><dd style={{margin:0}}>{reg.companyEmail}</dd>
      <dt style={{color:'#64748b'}}>Company phone</dt><dd style={{margin:0}}>{reg.companyPhone||'—'}</dd>
      <dt style={{color:'#64748b'}}>Website</dt><dd style={{margin:0}}>{reg.website?<a href={reg.website} target="_blank" rel="noopener noreferrer nofollow">{reg.website}</a>:'—'}</dd>
     </dl>
     <dl style={{margin:0,display:'grid',gridTemplateColumns:'auto 1fr',gap:'6px 14px',fontSize:14}}>
      <dt style={{color:'#64748b'}}>Contact person</dt><dd style={{margin:0}}>{reg.contactName?`${reg.contactName}, ${reg.contactPosition}`:'—'}{reg.contactEmail&&<><br/><small>{reg.contactEmail} · {reg.contactPhone}</small></>}</dd>
      <dt style={{color:'#64748b'}}>Administrator</dt><dd style={{margin:0}}>{reg.adminName}{reg.adminJobTitle?`, ${reg.adminJobTitle}`:''}</dd>
      <dt style={{color:'#64748b'}}>Admin email</dt><dd style={{margin:0}}>{reg.adminEmail} {reg.emailVerifiedAt?<small style={{color:'#15803d'}}>confirmed {fmt(reg.emailVerifiedAt)}</small>:reg.source==='PLATFORM_ADMIN'?<small>entered by platform</small>:<small style={{color:'#b45309'}}>not confirmed</small>}</dd>
      <dt style={{color:'#64748b'}}>Admin phone</dt><dd style={{margin:0}}>{reg.adminPhone||'—'}</dd>
      <dt style={{color:'#64748b'}}>Plan</dt><dd style={{margin:0}}>{reg.planName||'—'} ({reg.billingCycle.toLowerCase()})</dd>
      <dt style={{color:'#64748b'}}>Workspace</dt><dd style={{margin:0}}>{reg.companyCode?`${reg.companyCode}${reg.activatedAt?` · active since ${fmt(reg.activatedAt)}`:' · inactive until accepted'}`:'Not created'}</dd>
      {reg.rejectionReason&&<><dt style={{color:'#64748b'}}>Rejection reason</dt><dd style={{margin:0}}>{reg.rejectionReason}</dd></>}
      {reg.notes&&<><dt style={{color:'#64748b'}}>Applicant notes</dt><dd style={{margin:0,whiteSpace:'pre-wrap'}}>{reg.notes}</dd></>}
     </dl>
    </div>

    {reg.status==='PENDING_REVIEW'&&<form onSubmit={e=>{e.preventDefault();if(!window.confirm(`Approve ${reg.companyName}, create workspace ${approve.companyCode} and email ${reg.adminEmail} an activation link?`))return;void act({action:'approve',id:reg.id,...approve})}} style={{marginTop:20,padding:16,border:'1px solid #e2e8f0',borderRadius:8}}>
     <h4 style={{margin:'0 0 10px'}}>Approve and create workspace</h4>
     <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Company code<input required pattern="[A-Za-z0-9_\-]{2,30}" maxLength={30} value={approve.companyCode} onChange={e=>setApprove(a=>({...a,companyCode:e.target.value.toUpperCase()}))}/></label>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Plan<select required value={approve.planId} onChange={e=>setApprove(a=>({...a,planId:e.target.value}))}><option value="">Select plan</option>{detail!.plans.map(p=><option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}</select></label>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Billing<select value={approve.billingCycle} onChange={e=>setApprove(a=>({...a,billingCycle:e.target.value}))}>{BILLING_CYCLES.map(c=><option key={c} value={c}>{c==='MONTHLY'?'Monthly':'Annual'}</option>)}</select></label>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600,flex:'1 1 240px'}}>Internal review note<input maxLength={500} value={approve.reviewNotes} onChange={e=>setApprove(a=>({...a,reviewNotes:e.target.value}))} placeholder="e.g. Verified business registration by phone"/></label>
     </div>
     {highFlags.length>0&&<label style={{display:'flex',gap:8,marginTop:12,fontSize:14}}><input type="checkbox" checked={approve.acknowledgeDuplicates} onChange={e=>setApprove(a=>({...a,acknowledgeDuplicates:e.target.checked}))}/>I have checked the duplicate warnings and this is a separate company.</label>}
     <p style={{fontSize:13,color:'#64748b',margin:'10px 0'}}>Creates the company (inactive), a Head Office branch, a company Administrator role, the administrator login (inactive), plan modules, a pending subscription and a billing profile — all in one transaction.</p>
     <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="primaryBtn" disabled={busy||!detail?.emailConfigured||blocking||(highFlags.length>0&&!approve.acknowledgeDuplicates)}>{busy?'Working…':'Approve and send invitation'}</button><button type="button" className="outlineBtn" disabled={busy} onClick={()=>setPending('reject')}>Reject…</button></div>
    </form>}

    {reg.status==='PENDING_VERIFICATION'&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:18}}><button type="button" className="outlineBtn" disabled={busy} onClick={()=>act({action:'resendVerification',id:reg.id})}>Resend confirmation email</button><button type="button" className="outlineBtn" disabled={busy} onClick={()=>setPending('markVerified')}>Mark email verified…</button><button type="button" className="outlineBtn" disabled={busy} onClick={()=>setPending('reject')}>Reject…</button></div>}
    {reg.status==='APPROVED'&&<div style={{marginTop:18}}><p style={{margin:'0 0 8px'}}>{activeInvite?<>Invitation sent {fmt(activeInvite.sentAt||activeInvite.createdAt)} — expires {fmt(activeInvite.expiresAt)}.</>:<b style={{color:'#b91c1c'}}>No working invitation link. Resend the invitation so the administrator can activate the workspace.</b>}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" className="primaryBtn" disabled={busy||!detail?.emailConfigured} onClick={()=>act({action:'resendInvitation',id:reg.id})}>Resend invitation</button><button type="button" className="outlineBtn" disabled={busy} onClick={()=>setPending('cancel')}>Cancel approval…</button></div></div>}

    {pending&&<form onSubmit={e=>{e.preventDefault();void act({action:pending,id:reg.id,reason,notifyApplicant:notify})}} style={{marginTop:16,padding:14,borderRadius:8,background:'#f8fafc',border:'1px solid #e2e8f0'}}>
     <label style={{display:'flex',flexDirection:'column',gap:4,fontWeight:600}}>{pending==='reject'?'Reason for rejection (shared with the applicant)':pending==='cancel'?'Reason for cancelling (internal; the invitation link stops working)':'How did you confirm this email address?'}<textarea required minLength={8} maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
     {pending==='reject'&&<label style={{display:'flex',gap:8,marginTop:8}}><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)}/>Email the reason to {reg.adminEmail}</label>}
     <div style={{display:'flex',gap:8,marginTop:10}}><button className="primaryBtn" disabled={busy||reason.trim().length<8}>{pending==='reject'?'Reject registration':pending==='cancel'?'Cancel approval':'Mark verified'}</button><button type="button" className="outlineBtn" onClick={()=>{setPending(null);setReason('')}}>Back</button></div>
    </form>}

    <h4 style={{margin:'24px 0 8px'}}>Onboarding trail</h4>
    <ol style={{listStyle:'none',padding:0,margin:0,borderLeft:'2px solid #e2e8f0'}}>
     {detail!.trail.map(t=><li key={t.id} style={{padding:'6px 0 10px 14px',position:'relative'}}><span aria-hidden style={{position:'absolute',left:-6,top:11,width:10,height:10,borderRadius:5,background:t.action.includes('FAILED')||t.action.includes('REJECTED')?'#dc2626':t.action==='COMPANY_ACTIVATED'?'#16a34a':'#94a3b8'}}/><b>{ACTION_LABEL[t.action]||t.action}</b> <small style={{color:'#64748b'}}>{fmt(t.createdAt)} · {t.actor}</small>{t.detail?.note&&<div style={{whiteSpace:'pre-wrap'}}>{t.detail.note}</div>}{t.detail?.reason&&<div>Reason: {t.detail.reason}</div>}{t.detail?.notes&&<div>{t.detail.notes}</div>}</li>)}
    </ol>
    <form onSubmit={e=>{e.preventDefault();void act({action:'note',id:reg.id,note})}} style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}><input aria-label="Add an internal note" placeholder="Add an internal note (e.g. called applicant)" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} style={{flex:'1 1 320px'}}/><button className="outlineBtn" disabled={busy||note.trim().length<2}>Add note</button></form>
   </>}
  </div>}

  {view==='assisted'&&<form onSubmit={e=>{e.preventDefault();if(form.approveNow&&!window.confirm(`Create ${form.companyName||'this company'}'s workspace now and email ${form.adminEmail||'the administrator'} an activation link?`))return;void act({action:'createAssisted',...form,...(form.adminSameAsContact?{adminName:form.contactName,adminEmail:form.contactEmail,adminPhone:form.contactPhone,adminJobTitle:form.contactPosition}:{})})}}>
   <p style={{marginTop:0,color:'#475569'}}>Use this when a company signs up through sales or asks you to set it up. No confirmation email is needed — you vouch for the details. The administrator still sets their own password through a one-time link; you never see or share it.</p>
   <h4>Company</h4>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
    {F({k:"companyName",label:"Company name",required:true})}
    {Sel('companyType','Company type',COMPANY_TYPES)}
    {F({k:"registrationNumber",label:"Business registration number",required:true,max:40})}{F({k:"taxIdentifier",label:"Ghana Card / TIN number",required:true,max:30})}
    {Sel('industry','Industry / business category',INDUSTRIES)}
    <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Employees<select value={form.employeeBand} onChange={e=>set('employeeBand',e.target.value)}><option value="">—</option>{EMPLOYEE_BANDS.map(i=><option key={i}>{i}</option>)}</select></label>
    {F({k:"businessAddress",label:"Business address",required:true,max:500})}{F({k:"digitalAddress",label:"Digital address (GhanaPost GPS)",required:true,max:20})}{F({k:"city",label:"City or town",max:80})}
    {F({k:"companyEmail",label:"Company email",type:"email",required:true,max:254})}{F({k:"companyPhone",label:"Company phone",required:true,max:40})}{F({k:"website",label:"Website",max:200})}
   </div>
   <h4>Contact person</h4>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{F({k:"contactName",label:"Full name",required:true})}{F({k:"contactPosition",label:"Position",required:true})}{F({k:"contactPhone",label:"Phone",required:true,max:40})}{F({k:"contactEmail",label:"Email",type:"email",required:true,max:254})}</div>
   <h4>First administrator</h4>
   <label style={{display:'flex',gap:8,marginBottom:10,fontSize:14}}><input type="checkbox" checked={form.adminSameAsContact} onChange={e=>set('adminSameAsContact',e.target.checked)}/>The contact person is the administrator</label>
   {!form.adminSameAsContact&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{F({k:"adminName",label:"Full name",required:true})}{F({k:"adminEmail",label:"Email (their sign-in)",type:"email",required:true,max:254})}{F({k:"adminPhone",label:"Phone",max:40})}{F({k:"adminJobTitle",label:"Job title"})}</div>}
   {form.adminSameAsContact&&fields.adminEmail&&<small style={{color:'#b91c1c'}}>{fields.adminEmail}</small>}
   <h4>Subscription</h4>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
    <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Plan *<select required value={form.planId} onChange={e=>set('planId',e.target.value)}><option value="">Select plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}</select>{fields.planId&&<small style={{color:'#b91c1c'}}>{fields.planId}</small>}</label>
    <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Billing<select value={form.billingCycle} onChange={e=>set('billingCycle',e.target.value)}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select></label>
   </div>
   <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600,marginTop:12}}>Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
   <label style={{display:'flex',gap:8,marginTop:16}}><input type="checkbox" checked={form.approveNow} onChange={e=>set('approveNow',e.target.checked)}/>Approve now: create the workspace and send the activation link</label>
   {form.approveNow&&<div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:10}}><label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13,fontWeight:600}}>Company code (optional)<input maxLength={30} pattern="[A-Za-z0-9_\-]{2,30}" placeholder="Generated if blank" value={form.companyCode} onChange={e=>set('companyCode',e.target.value.toUpperCase())}/></label><label style={{display:'flex',gap:8,alignItems:'center',fontSize:14}}><input type="checkbox" checked={form.acknowledgeDuplicates} onChange={e=>set('acknowledgeDuplicates',e.target.checked)}/>Approve even if the name matches an existing company</label></div>}
   <div style={{marginTop:18}}><button className="primaryBtn" disabled={busy||(form.approveNow&&!emailOk)}>{busy?'Working…':form.approveNow?'Create workspace and send invitation':'Add to review queue'}</button></div>
  </form>}
 </section>;
}
