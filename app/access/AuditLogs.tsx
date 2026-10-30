'use client';
import {useEffect,useState} from 'react';

type Row={id:string;createdAt:string;action:string;entity:string;entityId:string|null;actor:{name:string;email:string}|null;detail:unknown};
type User={id:string;name:string;email:string;active:boolean};
async function jsonResponse(r:Response){
 const raw=await r.text();
 let data:any;
 try{data=JSON.parse(raw)}catch{throw Error('Server returned an invalid response (HTTP '+r.status+'). Check Railway logs.')} 
 if(!r.ok)throw Error(data.error||'Request failed (HTTP '+r.status+')');
 return data;
}
export default function AuditLogs(){
 const [rows,setRows]=useState<Row[]>([]);
 const [users,setUsers]=useState<User[]>([]);
 const [selectedUser,setSelectedUser]=useState('');
 const [search,setSearch]=useState('');
 const [term,setTerm]=useState('');
 const [page,setPage]=useState(1);
 const [total,setTotal]=useState(0);
 const [error,setError]=useState('');
 const [userError,setUserError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  fetch('/api/access/audit?mode=users',{cache:'no-store'}).then(jsonResponse).then(data=>{if(!cancelled)setUsers(data.users||[])}).catch(e=>{if(!cancelled)setUserError(e.message)});
  return()=>{cancelled=true};
 },[]);
 useEffect(()=>{
  let cancelled=false;
  setBusy(true);
  const params=new URLSearchParams({page:String(page),search:term});
  if(selectedUser)params.set('userId',selectedUser);
  fetch('/api/access/audit?'+params.toString(),{cache:'no-store'}).then(jsonResponse).then(data=>{
   if(!cancelled){setRows(data.items||[]);setTotal(data.total||0);setError('')}
  }).catch(e=>{if(!cancelled){setError(e.message);setRows([]);setTotal(0)}}).finally(()=>{if(!cancelled)setBusy(false)});
  return()=>{cancelled=true};
 },[page,term,selectedUser]);
 const user=users.find(x=>x.id===selectedUser);
 return <section className="workCard" style={{padding:22}}>
  <h2>Audit Logs</h2>
  <p>Recorded administrative and system activity. Existing logs are retained.</p>
  <form onSubmit={e=>{e.preventDefault();setPage(1);setTerm(search)}} style={{display:'flex',gap:10,margin:'15px 0',flexWrap:'wrap',alignItems:'end'}}>
   <label style={{display:'flex',flexDirection:'column',gap:5,fontSize:13,fontWeight:600}}>Filter by User
    <select aria-label="Filter audit logs by user" value={selectedUser} onChange={e=>{setSelectedUser(e.target.value);setPage(1)}} style={{minWidth:245,minHeight:40}}>
     <option value="">All Users</option>
     {users.map(u=><option key={u.id} value={u.id}>{u.name||u.email} ({u.email}){!u.active?' — Inactive':''}</option>)}
    </select>
   </label>
   <label style={{display:'flex',flexDirection:'column',gap:5,fontSize:13,fontWeight:600}}>Search Audit Logs
    <input aria-label="Search audit logs" placeholder="Action, entity or record ID" value={search} onChange={e=>setSearch(e.target.value)} style={{minHeight:40}}/>
   </label>
   <button className="primaryBtn" type="submit">Search</button>
   <button className="outlineBtn" type="button" onClick={()=>{setSelectedUser('');setSearch('');setTerm('');setPage(1)}}>Clear Filters</button>
  </form>
  {userError&&<p role="alert">Unable to load user list: {userError}</p>}
  {user&&<p>Showing activities performed by <strong>{user.name||user.email}</strong>.</p>}
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  {busy&&<p>Loading…</p>}
  <div className="tableWrap"><table className="dataTable"><thead><tr><th>Date / Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.actor?.name||r.actor?.email||'System'}</td><td>{r.action}</td><td>{r.entity}{r.entityId?' · '+r.entityId:''}</td><td><details><summary>View</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxWidth:400}}>{JSON.stringify(r.detail,null,2)||'—'}</pre></details></td></tr>)}
  </tbody></table></div>
  {!busy&&!error&&!rows.length&&<p>No recorded activity found for the selected filters.</p>}
  <div style={{display:'flex',gap:12,alignItems:'center',marginTop:16}}>
   <button className="outlineBtn" type="button" disabled={page===1||busy} onClick={()=>setPage(x=>x-1)}>Previous</button>
   <span>Page {page} · {total} matching records</span>
   <button className="outlineBtn" type="button" disabled={page*25>=total||busy} onClick={()=>setPage(x=>x+1)}>Next</button>
  </div>
 </section>;
}
