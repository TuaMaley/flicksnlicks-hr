 'use client';
import {useEffect,useState} from 'react';import type {ChangeEvent} from 'react';import Link from 'next/link';import Image from 'next/image';
type Employee = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  department: string;
  status: string;
  employmentType: string;
  hireDate: string;
  branchId: string;
  branch: { name: string };
};
const today = new Date().toLocaleDateString('en-CA');

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  branchId: '',
  employmentType: 'FULL_TIME',
  hireDate: today,
  emergencyContact: ''
};
export default function Employees(){const [bulkOpen,setBulkOpen]=useState(false),[bulkFile,setBulkFile]=useState<File|null>(null),[bulkLoading,setBulkLoading]=useState(false),[bulkErrors,setBulkErrors]=useState<{row:number;error:string}[]>([]),[bulkPreview,setBulkPreview]=useState<{row:number;firstName:string;lastName:string;email:string;branch:string;hireDate:string}[]>([]),[bulkError,setBulkError]=useState(''),[bulkValidated,setBulkValidated]=useState(false);const [rows,setRows]=useState<Employee[]>([]),[branches,setBranches]=useState<{id:string;name:string}[]>([]),[q,setQ]=useState(''),[branch,setBranch]=useState(''),[form,setForm]=useState(empty),[show,setShow]=useState(false),[edit,setEdit]=useState<Employee|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[canCreate,setCanCreate]=useState(false),[canEdit,setCanEdit]=useState(false);
async function load(){setLoading(true);const [er,br,me]=await Promise.all([fetch('/api/employees?q='+encodeURIComponent(q)+'&branchId='+encodeURIComponent(branch)),fetch('/api/branches'),fetch('/api/me')]);if(er.status===401){location.href='/login';return}if(er.ok)setRows((await er.json()).employees);else setError((await er.json()).error);if(br.ok)setBranches((await br.json()).branches);if(me.ok){const x=await me.json();setCanCreate(x.permissions.includes('employees.create'));setCanEdit(x.permissions.includes('employees.edit'))}setLoading(false)}
useEffect(()=>{load()},[q,branch]);async function save(e:React.FormEvent){e.preventDefault();setError('');const url=edit?'/api/employees/'+edit.id:'/api/employees';const r=await fetch(url,{method:edit?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json();if(!r.ok){setError(d.error||'Unable to save');return}setShow(false);setEdit(null);setForm(empty);setMessage(edit?'Employee updated successfully':'Employee registered successfully');load()}
function startEdit(x: Employee) {
  setEdit(x);

  setForm({
    firstName: x.firstName,
    lastName: x.lastName,
    email: x.email,
    phone: x.phone || '',
    position: x.position,
    department: x.department,
    branchId: x.branchId,
    employmentType: x.employmentType,
    hireDate: x.hireDate
      ? x.hireDate.substring(0, 10)
      : '',
    emergencyContact: ''
  });

  setShow(true);
}
async function bulkAction(mode:'preview'|'import'){
 if(!bulkFile)return;setBulkLoading(true);setBulkError('');setBulkErrors([]);
 try{const data=new FormData();data.append('file',bulkFile);data.append('mode',mode);const r=await fetch('/api/employees/bulk',{method:'POST',body:data});const d=await r.json();
 if(!r.ok){setBulkError(d.error||'Bulk upload failed');setBulkErrors(d.errors||[]);setBulkValidated(false);return;}
 if(mode==='preview'){setBulkPreview(d.preview||[]);setBulkValidated(true)}else{setBulkOpen(false);setBulkFile(null);setBulkPreview([]);setBulkValidated(false);setMessage(`${d.created} employees registered successfully`);await load()}
 }catch{setBulkError('Unable to process spreadsheet')}finally{setBulkLoading(false)}
 }
 function pickBulkFile(e:ChangeEvent<HTMLInputElement>){setBulkFile(e.target.files?.[0]||null);setBulkValidated(false);setBulkErrors([]);setBulkPreview([]);setBulkError('')}
 return <div className="workspace"><div className="workspaceTop"><Link href="/" className="backLink">← Dashboard</Link><div className="workspaceBrand"><Image src="/logo.png" width={44} height={44} alt="Flicks & Licks"/><span>FLICKS & LICKS HRMS</span></div></div><div className="workspaceHeading"><div><h1>Employee Management</h1><p>Employee directory, branch assignments and employment records</p></div>{canCreate&&<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="primaryBtn" onClick={()=>{setEdit(null);setForm({...empty,hireDate:new Date().toLocaleDateString('en-CA')});setShow(true);setError('')}}>+ Add Employee</button><button className="outlineBtn" onClick={()=>{setBulkOpen(true);setBulkError('');setBulkErrors([])}}>↑ Bulk Upload Employees</button></div>}</div>{message&&<div className="successNotice">{message}</div>}<section className="workCard"><div className="workFilters"><input placeholder="Search by name or employee ID" value={q} onChange={e=>setQ(e.target.value)}/><select value={branch} onChange={e=>setBranch(e.target.value)}><option value="">All permitted branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><span>{rows.length} employees</span></div><div className="tableWrap"><table className="dataTable"><thead><tr><th>Employee</th><th>ID</th><th>Department</th><th>Position</th><th>Branch</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.firstName} {x.lastName}</strong><small>{x.email}</small></td><td>{x.employeeNo}</td><td>{x.department}</td><td>{x.position}</td><td>{x.branch.name}</td><td><span className={'pill '+(x.status==='ACTIVE'?'active':'')}>{x.status.replaceAll('_',' ')}</span></td><td>{canEdit?<button className="outlineBtn" onClick={()=>startEdit(x)}>Edit</button>:<span>View only</span>}</td></tr>)}</tbody></table>{!loading&&rows.length===0&&<div className="emptyState">No employees found. HR can register the first employee.</div>}{loading&&<div className="emptyState">Loading employee records…</div>}</div></section>{bulkOpen&&<div className="modalShade" onClick={()=>setBulkOpen(false)}><div className="modalForm" onClick={e=>e.stopPropagation()} style={{maxWidth:760,width:'95%',maxHeight:'85vh',overflowY:'auto'}}><div className="modalHead"><h2>Bulk Employee Registration</h2><button type="button" onClick={()=>setBulkOpen(false)}>✕</button></div><p>Download the template, complete the employee details, then upload the Excel file. All rows must be valid before registration.</p><p><a className="outlineBtn" href="/api/employees/bulk" download="Nexora_Employee_Import_Template.xlsx">Download Excel Template</a></p><label>Excel spreadsheet (.xlsx)<input type="file" accept=".xlsx" onChange={pickBulkFile}/></label>{bulkError&&<div className="formError">{bulkError}</div>}{bulkErrors.length>0&&<div className="formError"><strong>Corrections required:</strong><ul>{bulkErrors.map((x,i)=><li key={i}>Row {x.row}: {x.error}</li>)}</ul></div>}{bulkValidated&&<div><h3>{bulkPreview.length} employees ready for registration</h3><div className="tableWrap"><table className="dataTable"><thead><tr><th>Row</th><th>Employee</th><th>Email</th><th>Branch</th><th>Hire Date</th></tr></thead><tbody>{bulkPreview.map(x=><tr key={x.row}><td>{x.row}</td><td>{x.firstName} {x.lastName}</td><td>{x.email}</td><td>{x.branch}</td><td>{x.hireDate}</td></tr>)}</tbody></table></div></div>}<div className="modalActions"><button className="outlineBtn" type="button" onClick={()=>setBulkOpen(false)}>Cancel</button><button className="outlineBtn" type="button" disabled={!bulkFile||bulkLoading} onClick={()=>bulkAction('preview')}>{bulkLoading?'Processing...':'Validate & Preview'}</button><button className="primaryBtn" type="button" disabled={!bulkValidated||bulkLoading} onClick={()=>bulkAction('import')}>Confirm Registration</button></div></div></div>}{show&&<div className="modalShade" onClick={()=>setShow(false)}><form className="modalForm" onClick={e=>e.stopPropagation()} onSubmit={save}><div className="modalHead"><h2>{edit?'Edit Employee':'Register Employee'}</h2><button type="button" onClick={()=>setShow(false)}>✕</button></div><div className="formGrid">{([['firstName','First name'],['lastName','Last name'],['email','Email'],['phone','Phone'],['position','Position'],['department','Department'],['emergencyContact','Emergency contact']] as const).map(([key,label])=><label key={key}>{label}<input type={key==='email'?'email':'text'} required={['firstName','lastName','email','position','department'].includes(key)} disabled={!!edit&&key==='email'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label>Branch<select required value={form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Employment type<select value={form.employmentType} onChange={e=>setForm({...form,employmentType:e.target.value})}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="CASUAL">Casual</option></select></label><label>
  Hire Date
  <input
    type="date"
    required
    value={form.hireDate}
    onChange={e =>
      setForm({
        ...form,
        hireDate: e.target.value
      })
    }
  />
</label></div>{error&&<div className="formError">{error}</div>}<div className="modalActions"><button type="button" className="outlineBtn" onClick={()=>setShow(false)}>Cancel</button><button className="primaryBtn">{edit?'Save changes':'Register employee'}</button></div></form></div>}</div>}
