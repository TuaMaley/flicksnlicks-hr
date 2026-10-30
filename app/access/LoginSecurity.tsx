'use client';
import {useEffect,useState} from 'react';
type User={id:string;name:string;email:string;active:boolean};
type Row={id:string;createdAt:string;action:string;entity:string;actor:User|null;detail:unknown};
export default function LoginSecurity(){
 const [rows,setRows]=useState<Row[]>([]),[users,setUsers]=useState<User[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [userId,setUserId]=useState(''),[event,setEvent]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError('');
  const params=new URLSearchParams({page:String(page)});
  if(userId)params.set('userId',userId);if(event)params.set('event',event);if(start)params.set('start',start);if(end)params.set('end',end);
  fetch('/api/access/security?'+params.toString(),{cache:'no-store'}).then(async response=>{
   const body=await response.text();let data:any;
   try{data=JSON.parse(body)}catch{throw new Error('Security API did not return JSON (HTTP '+response.status+'). Check Railway logs.')}
   if(!response.ok)throw new Error(data.error||'Unable to load events');
   if(!cancelled){setRows(data.items||[]);setUsers(data.users||[]);setTotal(data.total||0)}
  }).catch(err=>{if(!cancelled)setError(err.message||'Unable to load events')}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[page,userId,event,start,end]);
 const change=(fn:(value:string)=>void)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>{fn(e.target.value);setPage(1)};
 return <section className="workCard" style={{padding:22}}><h2>Login &amp; Security</h2><p>Successful logins, failed attempts and logouts. Historical LOGIN records are included.</p>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',margin:'18px 0'}}>
  <label>User<br/><select value={userId} onChange={change(setUserId)}><option value="">All users</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email}){u.active?'':' — inactive'}</option>)}</select></label>
  <label>Event<br/><select value={event} onChange={change(setEvent)}><option value="">All events</option><option value="LOGIN">Historical login</option><option value="LOGIN_SUCCESS">Successful login</option><option value="LOGIN_FAILURE">Failed login</option><option value="LOGOUT">Logout</option></select></label>
  <label>From (UTC)<br/><input type="date" value={start} onChange={change(setStart)}/></label>
  <label>To (UTC)<br/><input type="date" value={end} onChange={change(setEnd)}/></label>
  <button className="outlineBtn" type="button" onClick={()=>{setUserId('');setEvent('');setStart('');setEnd('');setPage(1)}}>Clear Filters</button>
 </div>
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{loading&&<p>Loading events…</p>}
 <div className="tableWrap"><table className="dataTable"><thead><tr><th>Time</th><th>Account</th><th>Event</th><th>Context</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.actor?.name||r.actor?.email||'Anonymous / unknown'}</td><td>{r.action==='LOGIN'?'LOGIN (historical)':r.action}</td><td><details><summary>View</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxWidth:440}}>{JSON.stringify(r.detail,null,2)||'No additional details'}</pre></details></td></tr>)}</tbody></table></div>
 {!loading&&!error&&rows.length===0&&<p>No authentication events match these filters.</p>}
 <div style={{display:'flex',gap:12,alignItems:'center',marginTop:16}}><button className="outlineBtn" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} · {total} matching events</span><button className="outlineBtn" disabled={page*25>=total||loading} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 </section>;
}
