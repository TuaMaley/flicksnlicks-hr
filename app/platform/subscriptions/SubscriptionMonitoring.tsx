'use client';
import {useMemo,useState} from 'react';
type Subscription={id:string;companyId:string;planName:string;startsAt:string;endsAt:string;status:string;company:{name:string}};
const day=86400000;
function dateOnly(s:string){return s.slice(0,10)}
function dateNumber(s:string){return Date.parse(dateOnly(s)+'T00:00:00Z')}
export default function SubscriptionMonitoring({subscriptions,onRefresh}:{subscriptions:Subscription[];onRefresh:()=>Promise<void>}){
 const [filter,setFilter]=useState('all'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const today=dateNumber(new Date().toISOString());
 const records=useMemo(()=>subscriptions.map(s=>{
  const remaining=Math.ceil((dateNumber(s.endsAt)-today)/day);
  const state=s.status==='CANCELLED'?'Cancelled':dateNumber(s.startsAt)>today?'Scheduled':remaining<0?'Expired':remaining<=30?'Expiring soon':'Active';
  return {...s,remaining,state};
 }),[subscriptions,today]);
 const counts={total:records.length,active:records.filter(s=>s.state==='Active').length,soon:records.filter(s=>s.state==='Expiring soon').length,expired:records.filter(s=>s.state==='Expired').length,scheduled:records.filter(s=>s.state==='Scheduled').length,cancelled:records.filter(s=>s.state==='Cancelled').length};
 const filtered=records.filter(s=>filter==='all'||s.state===filter).sort((a,b)=>dateNumber(a.endsAt)-dateNumber(b.endsAt));
 async function refresh(){setBusy(true);setError('');try{await onRefresh()}catch(e:any){setError(e.message||'Unable to refresh')}finally{setBusy(false)}}
 return <section className="workCard" style={{padding:24,margin:'18px 0'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h2>Subscription health & expiry monitoring</h2><p>Live summary of saved subscription periods. Expiring soon means within 30 days, including today.</p></div><button type="button" onClick={refresh} disabled={busy}>{busy?'Refreshing…':'Refresh status'}</button></div>
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:12,margin:'18px 0'}}>{([['Total',counts.total],['Active',counts.active],['Expiring in 30 days',counts.soon],['Expired',counts.expired],['Scheduled',counts.scheduled],['Cancelled',counts.cancelled]] as const).map(([label,value])=><div key={label} style={{border:'1px solid #e5e7eb',borderRadius:10,padding:14}}><div style={{fontSize:12,color:'#6b7280'}}>{label}</div><strong style={{fontSize:24}}>{value}</strong></div>)}</div>
 <label>Filter subscriptions <select value={filter} onChange={e=>setFilter(e.target.value)} style={{marginLeft:8}}><option value="all">All statuses</option>{['Active','Expiring soon','Expired','Scheduled','Cancelled'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
 <div style={{overflowX:'auto',marginTop:14}}><table className="dataTable" style={{width:'100%'}}><thead><tr><th>Company</th><th>Plan</th><th>Start</th><th>Expiry</th><th>Days to expiry</th><th>Status</th></tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td>{s.company.name}</td><td>{s.planName}</td><td>{dateOnly(s.startsAt)}</td><td>{dateOnly(s.endsAt)}</td><td>{s.state==='Cancelled'?'—':s.remaining}</td><td>{s.state}</td></tr>)}{filtered.length===0&&<tr><td colSpan={6}>No subscriptions match this filter.</td></tr>}</tbody></table></div>
 <p style={{fontSize:12,color:'#6b7280',marginTop:12}}>Status is calculated from saved dates and cancellation state. This panel does not enforce access restrictions, send reminders, or collect payments.</p></section>
}
