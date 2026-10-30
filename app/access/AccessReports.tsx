'use client';
import {useEffect,useState} from 'react';
type Data={
 filters:{users:{id:string;name:string;email:string}[];branches:{id:string;name:string}[];departments:string[]};
 metrics:Record<string,number>;
 roleDistribution:{name:string;count:number}[];
 topUsers:{id:string;name:string;count:number}[];
 activityTrend:{date:string;count:number}[];
 note:string;
};
const cards:[string,string][]=[
 ['totalUsers','Total Users'],['activeUsers','Active Accounts'],['inactiveUsers','Inactive Accounts'],['totalRoles','Roles'],
 ['auditTotal','Audit Events'],['successfulLogins','Successful Logins'],['failedLogins','Failed Logins'],['logouts','Logouts'],
 ['privilegedUsers','Elevated Access Users'],['openReviews','Open Reviews'],['flaggedReviews','Flagged Reviews'],['overdueReviews','Overdue Reviews']
];
function saveCsv(name:string,rows:(string|number)[][]){
 const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function BarList({rows}:{rows:{name:string;count:number}[]}){
 const max=Math.max(1,...rows.map(x=>x.count));
 return <div>{rows.length?rows.map((x,i)=><div key={i} style={{margin:'12px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><span>{x.name}</span><strong>{x.count}</strong></div><div style={{background:'#eee',height:10,borderRadius:10,marginTop:5}}><div style={{background:'#c81020',width:(100*x.count/max)+'%',height:'100%',borderRadius:10}}/></div></div>):<p>No matching data.</p>}</div>
}
export default function AccessReports(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [userId,setUserId]=useState(''),[branchId,setBranchId]=useState(''),[department,setDepartment]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [filters,setFilters]=useState({userId:'',branchId:'',department:'',start:'',end:''});
 useEffect(()=>{let cancel=false;setLoading(true);const p=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v)p.set(k,v)});
 fetch('/api/access/reports?'+p.toString()).then(async r=>{const raw=await r.text();let result:any;try{result=JSON.parse(raw)}catch{throw Error('Reporting API returned an invalid response (HTTP '+r.status+')')}if(!r.ok)throw Error(result.error||'Report unavailable');if(!cancel){setData(result);setError('')}}).catch(e=>{if(!cancel)setError(e.message)}).finally(()=>{if(!cancel)setLoading(false)});
 return()=>{cancel=true};
 },[filters]);
 const apply=(e:React.FormEvent)=>{e.preventDefault();setFilters({userId,branchId,department,start,end})};
 const clear=()=>{setUserId('');setBranchId('');setDepartment('');setStart('');setEnd('');setFilters({userId:'',branchId:'',department:'',start:'',end:''})};
 const exportData=()=>{if(!data)return;saveCsv('nexora-access-analytics.csv',[
 ['Metric','Value'],...cards.map(([key,label])=>[label,data.metrics[key]||0]),[],
 ['Role','Assigned Users'],...data.roleDistribution.map(r=>[r.name,r.count]),[],
 ['Most Active User','Audit Events'],...data.topUsers.map(r=>[r.name,r.count]),[],
 ['Date (UTC)','Audit Events'],...data.activityTrend.map(r=>[r.date,r.count])
 ])};
 return <div style={{display:'grid',gap:18}}>
  <section className="workCard" style={{padding:22}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}><div><h2>Reports & Analytics</h2><p>Access, security and audit insights from PostgreSQL</p></div><button type="button" className="outlineBtn" onClick={exportData} disabled={!data}>Export CSV</button></div>
   <form onSubmit={apply} style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end',marginTop:18}}>
    <label>User<br/><select value={userId} onChange={e=>setUserId(e.target.value)}><option value="">All Users</option>{data?.filters.users.map(u=><option value={u.id} key={u.id}>{u.name} ({u.email})</option>)}</select></label>
    <label>Branch<br/><select value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">All Branches</option>{data?.filters.branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
    <label>Department<br/><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All Departments</option>{data?.filters.departments.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
    <label>From<br/><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>To<br/><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <button className="primaryBtn" type="submit">Apply Filters</button><button className="outlineBtn" type="button" onClick={clear}>Clear</button>
   </form>{error&&<p role="alert" style={{color:'#b91c1c',marginTop:14}}>{error}</p>}{loading&&<p>Loading analytics…</p>}
  </section>
  {data&&<><section className="workCard" style={{padding:22}}><h2>Security Overview</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginTop:14}}>{cards.map(([key,label])=><div key={key} style={{padding:16,border:'1px solid #e5e7eb',borderRadius:12,background:'#fafafa'}}><div style={{fontSize:12,color:'#555'}}>{label}</div><strong style={{fontSize:26}}>{(data.metrics[key]||0).toLocaleString()}</strong></div>)}</div></section>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(310px,1fr))',gap:18}}>
   <section className="workCard" style={{padding:22}}><h2>Role Distribution</h2><BarList rows={data.roleDistribution}/></section>
   <section className="workCard" style={{padding:22}}><h2>Most Active Users</h2><BarList rows={data.topUsers}/></section>
   <section className="workCard" style={{padding:22}}><h2>Audit Activity by Day (UTC)</h2><BarList rows={data.activityTrend.map(x=>({name:x.date,count:x.count}))}/></section>
  </div><section className="workCard" style={{padding:22}}><p style={{fontSize:12,color:'#555'}}>{data.note}</p></section></>}
 </div>;
}
