 'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';

type Balance={type:string;year:number;entitled:number;used:number;remaining:number};
type LeaveRequest={id:string;type:string;startDate:string;endDate:string;status:string;days:number};
type Data={year:number;balances:Balance[];requests:LeaveRequest[];canSubmitLeave:boolean;canViewLeave:boolean;links:{selfService:string;leave:string;payroll:string;performance:string}};
const types=['ANNUAL','SICK','MATERNITY','PATERNITY','COMPASSIONATE','UNPAID','OTHER'];
export default function NexHrActions({openLeaveRequest=0}:{openLeaveRequest?:number}){
 const [expanded,setExpanded]=useState(false),[data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const formRef=useRef<HTMLDivElement>(null);
 const lastHandled=useRef(0);
 const [type,setType]=useState('ANNUAL'),[startDate,setStartDate]=useState(''),[endDate,setEndDate]=useState(''),[reason,setReason]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/nex-hr/actions',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to load your HR information');setData(j)}catch(e){setError(e instanceof Error?e.message:'Unable to load')}finally{setLoading(false)}}
 useEffect(()=>{
  if(!openLeaveRequest||openLeaveRequest===lastHandled.current)return;
  lastHandled.current=openLeaveRequest;
  setExpanded(true);
  setType('ANNUAL');
  setNotice('Annual leave application opened. Select your dates, review the details, and confirm before submitting.');
  if(!data)void load();
 },[openLeaveRequest]);
 useEffect(()=>{
  if(openLeaveRequest&&expanded&&!loading&&data?.canSubmitLeave){
   formRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
 },[openLeaveRequest,expanded,loading,data]);
 async function submit(e:React.FormEvent){e.preventDefault();if(!data?.canSubmitLeave||sending)return;if(!startDate||!endDate){setError('Choose both dates');return}if(!window.confirm(`Submit ${type.toLowerCase()} leave from ${startDate} to ${endDate} for HR approval?`))return;
 setSending(true);setError('');setNotice('');try{const r=await fetch('/api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,startDate,endDate,reason})});const j=await r.json();if(!r.ok)throw Error(j.error||'Request not submitted');setNotice('Leave request submitted for approval. This is not an approval confirmation.');setStartDate('');setEndDate('');setReason('');await load()}catch(e){setError(e instanceof Error?e.message:'Request not submitted')}finally{setSending(false)}}
 return <div style={{border:'1px solid var(--border,#d4d4d8)',borderRadius:10,padding:12,marginBottom:12}}>
 <button type="button" onClick={()=>{setExpanded(v=>!v);if(!expanded&&!data)void load()}} aria-expanded={expanded} style={{fontWeight:700}}>HR Actions {expanded?'▴':'▾'}</button>
 {expanded&&<div style={{display:'grid',gap:12,marginTop:10}}>
 <p style={{margin:0,fontSize:13}}>View your own leave information or submit a request through Nexora's existing approval workflow. Nex HR cannot approve leave or disclose another employee's records.</p>
 {loading&&<p>Loading your HR information…</p>}{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 {data&&<><div><strong>Leave balances ({data.year})</strong>{data.canViewLeave?<ul style={{margin:'6px 0',paddingLeft:20}}>{data.balances.map(b=><li key={b.type}>{b.type}: {b.remaining} remaining ({b.used} used / {b.entitled} entitled)</li>)}</ul>:<p>Your role does not have leave viewing permission.</p>}</div>
 {data.canViewLeave&&<div><strong>Recent leave requests</strong>{data.requests.length?<ul style={{margin:'6px 0',paddingLeft:20}}>{data.requests.map(r=><li key={r.id}>{r.type}: {r.startDate.slice(0,10)} – {r.endDate.slice(0,10)} ({r.days} days) — {r.status}</li>)}</ul>:<p>No recent leave requests.</p>}</div>}
 {data.canSubmitLeave&&<div ref={formRef}><form onSubmit={submit} style={{display:'grid',gap:8}}><strong>Request leave</strong><label>Leave type <select value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Start date <input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>End date <input type="date" required min={startDate||undefined} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label><label>Reason (optional) <textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="submit" disabled={sending||!startDate||!endDate}>{sending?'Submitting…':'Review and submit leave request'}</button></form></div>}
 <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><Link href={data.links.selfService}>Employee Self-Service</Link><Link href={data.links.leave}>Leave management</Link><Link href={data.links.payroll}>Payroll</Link><Link href={data.links.performance}>Performance</Link></div><small>Payslips and appraisals open in their existing permission-controlled modules. They are not exposed in this chat.</small></>}
 </div>}</div>
}
