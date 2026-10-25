'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PerformanceSectionNav from '../PerformanceSectionNav';
import '../performance-ui.css';
type Report={id:string;employee:string;employeeNo:string;employeeId:string;department:string;branch:string;position:string;template:string;period:string;status:string;score:number|null;selfScores:unknown;managerScores:unknown;selfComment:string|null;managerComment:string|null;criteria:unknown;createdAt:string;approvedAt:string|null};
type Summary={total:number;completed:number;pending:number;rejected:number;averageScore:number|null;truncated:boolean};
const statusText=(s:string)=>s.replace(/_/g,' ').toLowerCase().replace(/\\b\\w/g,c=>c.toUpperCase());
const jsonText=(v:unknown)=>v==null?'—':typeof v==='string'?v:JSON.stringify(v,null,2);
export default function AppraisalReportsPage(){
 const [reports,setReports]=useState<Report[]>([]),[summary,setSummary]=useState<Summary|null>(null);
 const [period,setPeriod]=useState(''),[status,setStatus]=useState(''),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const params=useMemo(()=>{const p=new URLSearchParams();if(period)p.set('period',period);if(status)p.set('status',status);return p},[period,status]);
 useEffect(()=>{let active=true;setBusy(true);setError('');fetch('/api/appraisals/reports?'+params.toString(),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}).then(d=>{if(active){setReports(d.reports||[]);setSummary(d.summary)}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load reports')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[params]);
 const filtered=reports.filter(r=>`${r.employee} ${r.employeeNo} ${r.department} ${r.branch} ${r.template}`.toLowerCase().includes(query.toLowerCase()));
 const activeReport=filtered.find(r=>r.id===selected)||null;
 const download=()=>{window.location.href='/api/appraisals/reports?'+params.toString()+(params.toString()?'&':'')+'format=csv'};
 return <main className="workspace appraisalReportsPage">
 <div className="workspaceHeading"><div><h1>Appraisal Reports &amp; Export</h1><p>Review KPI results, approval outcomes and performance records.</p></div></div>
 <PerformanceSectionNav/>
 {error&&<div className="formError" role="alert">{error}</div>}
 <div className="reportSummary">
 <div><small>Total reviews</small><strong>{summary?.total??'—'}</strong></div>
 <div><small>Completed</small><strong>{summary?.completed??'—'}</strong></div>
 <div><small>Pending approval</small><strong>{summary?.pending??'—'}</strong></div>
 <div><small>Average rating / 5</small><strong>{summary?.averageScore??'—'}</strong></div>
 </div>
 <section className="reportPanel">
 <div className="reportToolbar">
 <label>Search employee or template<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, number, department, branch..."/></label>
 <label>Period<input value={period} onChange={e=>setPeriod(e.target.value)} placeholder="2026-Q4"/></label>
 <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['DRAFT','SUBMITTED','PENDING_HR_APPROVAL','APPROVED','FINALIZED','REJECTED'].map(s=><option key={s} value={s}>{statusText(s)}</option>)}</select></label>
 <button type="button" onClick={download} disabled={busy||!!error}>Export Excel (CSV)</button>
 <button type="button" onClick={()=>window.print()} disabled={busy||!!error}>Save as PDF / Print</button>
 </div>
 <p className="reportMeta">{busy?'Loading reports…':`${filtered.length} shown · ${summary?.rejected??0} rejected`}{summary?.truncated?' · First 2,000 records only':''}</p>
 <div className="reportTableWrap"><table className="reportTable"><thead><tr><th>Employee</th><th>Department / Branch</th><th>Template</th><th>Period</th><th>Status</th><th>Rating</th><th className="reportNoPrint">Details</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><strong>{r.employee}</strong><small>{r.employeeNo}</small></td><td>{r.department}<small>{r.branch}</small></td><td>{r.template}</td><td>{r.period}</td><td><span className={'reportBadge reportStatus'+r.status}>{statusText(r.status)}</span></td><td>{r.score===null?'—':`${r.score.toFixed(2)} / 5`}</td><td className="reportNoPrint"><button type="button" onClick={()=>setSelected(r.id===selected?'':r.id)}>View</button></td></tr>)}</tbody></table>{!busy&&!filtered.length&&<p>No appraisal records match the selected filters.</p>}</div>
 </section>
 {activeReport&&<section className="reportPanel reportDetail"><div className="reportDetailTitle"><h2>Individual Appraisal Report — {activeReport.employee}</h2><button type="button" className="reportNoPrint" onClick={()=>setSelected('')}>Close</button></div><p><strong>Employee number:</strong> {activeReport.employeeNo} &nbsp; <strong>Role:</strong> {activeReport.position}</p><p><strong>Branch:</strong> {activeReport.branch} &nbsp; <strong>Department:</strong> {activeReport.department}</p><p><strong>Template:</strong> {activeReport.template} &nbsp; <strong>Period:</strong> {activeReport.period}</p><p><strong>Status:</strong> {statusText(activeReport.status)} &nbsp; <strong>Rating:</strong> {activeReport.score??'Not scored'} / 5</p><h3>KPI criteria</h3><pre>{jsonText(activeReport.criteria)}</pre><h3>Employee KPI scores</h3><pre>{jsonText(activeReport.selfScores)}</pre><h3>Manager KPI scores</h3><pre>{jsonText(activeReport.managerScores)}</pre><h3>Employee comments</h3><p>{activeReport.selfComment||'—'}</p><h3>Manager comments</h3><p>{activeReport.managerComment||'—'}</p></section>}
 <style jsx>{`
 .reportSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:20px 0}.reportSummary>div,.reportPanel{background:#fff;border:1px solid #e1e6ee;border-radius:16px;padding:20px}.reportSummary small,.reportSummary strong{display:block}.reportSummary small{color:#64748b}.reportSummary strong{font-size:30px;color:#d71920;margin-top:6px}.reportToolbar{display:flex;flex-wrap:wrap;align-items:end;gap:12px}.reportToolbar label{font-size:12px;display:flex;flex-direction:column;gap:5px;min-width:155px;flex:1}.reportToolbar input,.reportToolbar select{border:1px solid #d8deea;border-radius:8px;padding:10px;background:white}.reportToolbar button,.reportNoPrint button,.reportDetailTitle button{border:1px solid #d7dce6;border-radius:8px;background:#f7f8fc;padding:10px 14px;cursor:pointer}.reportToolbar button:first-of-type{background:#cf161f;color:white}.reportMeta{color:#64748b}.reportTableWrap{overflow-x:auto}.reportTable{width:100%;border-collapse:collapse;text-align:left}.reportTable th,.reportTable td{padding:13px 10px;border-bottom:1px solid #e9edf3}.reportTable th{font-size:12px;color:#64748b;background:#f7f8fa}.reportTable td small{display:block;color:#64748b;margin-top:4px}.reportBadge{padding:5px 10px;border-radius:20px;background:#eef2ff;white-space:nowrap;font-size:12px}.reportStatusAPPROVED,.reportStatusFINALIZED{background:#dcfce7;color:#166534}.reportStatusREJECTED{background:#fee2e2;color:#991b1b}.reportDetail{margin-top:20px}.reportDetailTitle{display:flex;justify-content:space-between;gap:15px}.reportDetail pre{white-space:pre-wrap;word-break:break-word;background:#f6f8fb;border-radius:8px;padding:12px}.reportDetail h3{margin:20px 0 5px}@media(max-width:900px){.reportSummary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media print{.reportToolbar,.reportNoPrint,.pt-main-nav{display:none!important}.reportPanel{border:0;padding:0}.reportSummary{grid-template-columns:repeat(4,1fr)}.appraisalReportsPage{padding:0!important}.reportTableWrap{overflow:visible}.reportTable{font-size:10px}}
 `}</style>
 </main>
}
