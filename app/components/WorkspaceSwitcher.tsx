'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Building2,Check,ChevronDown,Layers3,ShieldCheck,AlertTriangle} from 'lucide-react';

type Company={id:string;name:string;code:string};
export default function WorkspaceSwitcher({isPlatform,platformAdmin}:{isPlatform:boolean;platformAdmin:boolean}){
 const [open,setOpen]=useState(false);
 const [companies,setCompanies]=useState<Company[]>([]);
 const [selected,setSelected]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;fetch('/api/company-context',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(active&&d){setCompanies(d.companies||[]);setSelected(d.activeCompanyId||'')}}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};const onPointer=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};document.addEventListener('keydown',onKey);document.addEventListener('mousedown',onPointer);return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('mousedown',onPointer)}},[open]);
 async function switchCompany(id:string){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/company-context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to select company');setSelected(id);window.location.assign('/')}catch(e){setError(e instanceof Error?e.message:'Unable to select company');setBusy(false)}}
 return <div className="nexoraWorkspace" ref={root}>
  <button className="nexoraWorkspaceTrigger" type="button" aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span className="nexoraWorkspaceSymbol"><Layers3 size={18}/></span><span className="nexoraWorkspaceText"><strong>Nexora Workspace</strong><small>{isPlatform?'Platform Administration':'Company HRMS'}</small></span><ChevronDown size={16} className={open?'nexoraWorkspaceChevron isOpen':'nexoraWorkspaceChevron'}/>
  </button>
  {open&&<div className="nexoraWorkspaceMenu" role="group" aria-label="Authorized workspaces">
   <div className="nexoraWorkspaceMenuTitle">SWITCH WORKSPACE</div>
   {platformAdmin&&<Link href="/platform" className="nexoraWorkspaceOption" onClick={()=>setOpen(false)}><ShieldCheck size={18}/><span>Platform Administration</span>{isPlatform&&<Check size={16}/>}</Link>}
   <div className="nexoraWorkspaceMenuTitle">COMPANY WORKSPACES</div>
   {companies.length?companies.map(c=><button type="button" key={c.id} className="nexoraWorkspaceOption" disabled={busy} onClick={()=>{if(isPlatform||selected!==c.id){void switchCompany(c.id)}else setOpen(false)}}><Building2 size={18}/><span>{c.name}</span>{!isPlatform&&selected===c.id&&<Check size={16}/>}</button>):<p className="nexoraWorkspaceEmpty">No company memberships available.</p>}
   <p className="nexoraWorkspaceNotice"><AlertTriangle size={15}/> Company selection is preview-only. HRMS data isolation is not yet verified.</p>
   {error&&<p className="nexoraWorkspaceError" role="alert">{error}</p>}
  </div>}
 </div>
}
