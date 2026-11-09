'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Position={id:string;name:string;active:boolean};
export default function Positions(){
 const [rows,setRows]=useState<Position[]>([]),[name,setName]=useState(''),[error,setError]=useState('');
 async function load(){const r=await fetch('/api/positions',{cache:'no-store'});const d=await r.json();if(!r.ok)setError(d.error||'Could not load');else setRows(d.positions)}
 useEffect(()=>{void load()},[]);
 async function create(e:React.FormEvent){e.preventDefault();setError('');const r=await fetch('/api/positions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const d=await r.json();if(!r.ok)setError(d.error||'Could not create');else{setName('');await load()}}
 async function change(d:Position){const name=prompt('Position name',d.name);if(name===null)return;const r=await fetch('/api/positions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,name,active:d.active})});if(!r.ok)setError((await r.json()).error);else await load()}
 async function toggle(d:Position){const r=await fetch('/api/positions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,name:d.name,active:!d.active})});if(!r.ok)setError((await r.json()).error);else await load()}
 return <main className="fnlSettingsPage"><Link href="/settings">← Settings</Link><h1>Job Position Management</h1><p>Manage job positions within your company.</p>{error&&<p role="alert" style={{color:'red'}}>{error}</p>}<section className="fnlSettingsCard"><form onSubmit={create}><label>Position name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primaryBtn">Create Position</button></form></section><section className="fnlSettingsCard">{rows.map(d=><div key={d.id} style={{padding:12,display:'flex',gap:12}}><strong>{d.name}</strong><span>{d.active?'Active':'Inactive'}</span><button onClick={()=>change(d)}>Edit</button><button onClick={()=>toggle(d)}>{d.active?'Deactivate':'Activate'}</button></div>)}</section></main>
}
