'use client';
import {useEffect,useState} from 'react';
import {Wallet,Users,Clock3,TrendingUp,Search,FileText,ShieldCheck,CalendarDays,ArrowUpRight} from 'lucide-react';
import './payroll.css';
type Run={id:string;period:string;status:string;gross:number;net:number};
type Data={activeEmployees:number;branches:{name:string;count:number}[];latest:{period:string;status:string;gross:number;net:number}|null;runs:Run[];pending:number|null;payrollTotalsRestricted:boolean};
const money=(v:number)=>new Intl.NumberFormat('en-GH',{style:'currency',currency:'GHS',maximumFractionDigits:2}).format(v);
export default function PayrollPage(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[search,setSearch]=useState('');
 useEffect(()=>{fetch('/api/payroll/overview',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load payroll');return d}).then(setData).catch(e=>setError(String(e.message||e))).finally(()=>setLoading(false))},[]);
 const filtered=(data?.runs||[]).filter(r=>`${r.period} ${r.status}`.toLowerCase().includes(search.toLowerCase()));
 const max=Math.max(1,...(data?.branches||[]).map(b=>b.count));
 return <main className="payrollWorkspace">
 <div className="payrollHeading"><div><span className="payrollEyebrow">FINANCE / PAYROLL</span><h1>Payroll &amp; Benefits</h1><p>Compensation, payroll operations and workforce insights in one place.</p></div><span className="payrollLive"><span/> Live PostgreSQL data</span></div>
 <nav className="payrollTabs" aria-label="Payroll sections"><a className="selected" href="/payroll">Overview</a><span>Compensation <em>Coming next</em></span><span>Attendance &amp; Overtime</span><span>Process Payroll</span><span>Approvals</span><span>Payslips</span><span>Payments</span><span>Reports</span></nav>
 {error&&<div className="payrollError" role="alert">{error}</div>}
 <div className="payrollCards">
 <article className="payrollCard"><div className="payrollCardIcon blue"><Wallet/></div><p>Latest gross payroll</p><strong>{loading?'…':data?.latest?money(data.latest.gross):'Not available'}</strong><small>{data?.latest?`Period ${data.latest.period}`:data?.payrollTotalsRestricted?'Restricted to authorized HR / Admin':'No payroll runs yet'}</small></article>
 <article className="payrollCard"><div className="payrollCardIcon green"><Users/></div><p>Active employees in scope</p><strong>{loading?'…':data?.activeEmployees??'—'}</strong><small>From employee records</small></article>
 <article className="payrollCard"><div className="payrollCardIcon orange"><Clock3/></div><p>Payroll runs awaiting approval</p><strong>{loading?'…':data?.pending??'—'}</strong><small>{data?.payrollTotalsRestricted?'Restricted':'Within 12 most recent payroll runs'}</small></article>
 <article className="payrollCard"><div className="payrollCardIcon red"><TrendingUp/></div><p>Latest net payroll</p><strong>{loading?'…':data?.latest?money(data.latest.net):'Not available'}</strong><small>{data?.latest?data.latest.status.replaceAll('_',' '):'No available payroll totals'}</small></article>
 </div>
 <div className="payrollGrid"><section className="payrollPanel"><div className="payrollPanelHead"><div><h2>Payroll trend</h2><p>Gross and net amounts for recent payroll runs</p></div><CalendarDays size={19}/></div>
 {data?.runs.length?<div className="payrollTrend">{[...data.runs].reverse().map(r=>{const mx=Math.max(1,...data.runs.map(x=>x.gross));return <div key={r.id} className="payrollTrendRow"><span>{r.period}</span><div className="payrollTrendTrack"><div style={{width:`${Math.max(1,r.gross/mx*100)}%`}} className="payrollGross"/><div style={{width:`${Math.max(1,r.net/mx*100)}%`}} className="payrollNet"/></div><b>{money(r.net)}</b></div>})}<div className="payrollLegend"><span>■ Gross</span><span>■ Net</span></div></div>:<div className="payrollEmpty">No payroll trend data available yet. Payroll amounts are only displayed to authorized HR / Admin users.</div>}
 </section><section className="payrollPanel"><div className="payrollPanelHead"><div><h2>Workforce by branch</h2><p>Active employees within your reporting scope</p></div><Users size={19}/></div>
 <div className="payrollBranches">{data?.branches.length?data.branches.map(b=><div key={b.name} className="payrollBranch"><div><strong>{b.name}</strong><span>{b.count} employees</span></div><div className="payrollBranchTrack"><i style={{width:`${b.count/max*100}%`}}/></div></div>):<div className="payrollEmpty">No branch records to display.</div>}</div></section></div>
 <section className="payrollPanel payrollActivity"><div className="payrollPanelHead"><div><h2>Recent payroll activity</h2><p>Review recent processing periods and statuses</p></div><label className="payrollSearch"><Search size={16}/><input aria-label="Search payroll runs" placeholder="Search period or status" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="payrollTableWrap"><table><thead><tr><th>PERIOD</th><th>STATUS</th><th>GROSS PAY</th><th>NET PAY</th><th>RECORD</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><b>{r.period}</b></td><td><span className={'payrollStatus '+r.status}>{r.status.replaceAll('_',' ')}</span></td><td>{money(r.gross)}</td><td>{money(r.net)}</td><td><FileText size={16}/></td></tr>)}</tbody></table>{!filtered.length&&<div className="payrollEmpty">No payroll runs found.</div>}</div></section>
 <div className="payrollFootnote"><ShieldCheck size={16}/> This overview is read-only. Salary packages, calculations, approvals and statutory deductions will be implemented in subsequent phases.</div>
 </main>;
}
