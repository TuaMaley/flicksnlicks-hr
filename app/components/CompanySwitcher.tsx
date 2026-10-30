'use client';
import {useEffect,useState} from 'react';
type Company={id:string;name:string;code:string;roles:string[]};
export default function CompanySwitcher(){
 const [companies,setCompanies]=useState<Company[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/company-context',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d){setCompanies(d.companies||[]);setSelected(d.activeCompanyId||'')}}).catch(()=>{})},[]);
 if(!companies.length)return null;
 return <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:12}}>Company (preview)
 <select aria-label="Select company membership (preview only)" value={selected} onChange={async e=>{const id=e.target.value;const r=await fetch('/api/company-context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:id})});const d=await r.json();if(!r.ok){setError(d.error||'Unable to switch');return}setSelected(id);setError('')}}>
 <option value="">Select company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{error&&<span role="alert">{error}</span>}</label>;
}
