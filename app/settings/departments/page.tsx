'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Department={id:string;name:string;active:boolean};
export default function Departments(){
 const [rows,setRows]=useState<Department[]>([]),[name,setName]=useState(''),[error,setError]=useState('');
 async function load(){const r=await fetch('/api/departments',{cache:'no-store'});const d=await r.json();if(!r.ok)setError(d.error||'Could not load');else setRows(d.departments)}
 useEffect(()=>{void load()},[]);
 async function create(e:React.FormEvent){e.preventDefault();setError('');const r=await fetch('/api/departments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const d=await r.json();if(!r.ok)setError(d.error||'Could not create');else{setName('');await load()}}
 async function change(d:Department){const name=prompt('Department name',d.name);if(name===null)return;const r=await fetch('/api/departments',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,name,active:d.active})});if(!r.ok)setError((await r.json()).error);else await load()}
 async function toggle(d:Department){const r=await fetch('/api/departments',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,name:d.name,active:!d.active})});if(!r.ok)setError((await r.json()).error);else await load()}
 return <main className="fnlSettingsPage"><Link href="/settings">← Settings</Link><h1>Department Management</h1><p>Manage departments within your company.</p>{error&&<p role="alert" style={{color:'red'}}>{error}</p>}<section className="fnlSettingsCard"><form onSubmit={create}><label>Department name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primaryBtn">Create Department</button></form></section><section className="fnlSettingsCard">{rows.map(d=><div key={d.id} style={{padding:12,display:'flex',gap:12}}><strong>{d.name}</strong><span>{d.active?'Active':'Inactive'}</span><button onClick={()=>change(d)}>Edit</button><button onClick={()=>toggle(d)}>{d.active?'Deactivate':'Activate'}</button></div>)}</section></main>
}
