'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import Link from 'next/link';
import {ChevronDown,LogOut,Settings,UserRound} from 'lucide-react';

type Me={name:string;email:string;roles:string[]};
export default function AccountMenu(){
 const pathname=usePathname(),router=useRouter();
 const [me,setMe]=useState<Me|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const wrapper=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   if(pathname==='/login'){setMe(null);return;}
   let cancelled=false;
   fetch('/api/me',{cache:'no-store'}).then(async r=>r.ok?await r.json():null)
     .then(data=>{if(!cancelled)setMe(data?{name:data.name,email:data.email,roles:data.roles||[]}:null)})
     .catch(()=>{if(!cancelled)setMe(null)});
   return ()=>{cancelled=true};
 },[pathname]);
 useEffect(()=>{
   function outside(e:MouseEvent){if(wrapper.current&&!wrapper.current.contains(e.target as Node))setOpen(false)}
   function esc(e:KeyboardEvent){if(e.key==='Escape')setOpen(false)}
   document.addEventListener('mousedown',outside);document.addEventListener('keydown',esc);
   return ()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',esc)};
 },[]);
 if(pathname==='/login'||!me)return null;
 const initials=me.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'FL';
 async function signOut(){
  setBusy(true);
  try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error('Sign out failed');router.replace('/login');router.refresh()}
  catch{setBusy(false);alert('Unable to sign out. Please try again.')}
 }
 return <div className="fnlAccountDock" ref={wrapper}>
  <button type="button" className="fnlAccountTrigger" aria-label="Account menu" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(v=>!v)}>
   <span className="fnlAccountAvatar">{initials}</span>
   <span className="fnlAccountIdentity"><strong>{me.name}</strong><small>Signed in</small></span>
   <ChevronDown size={17} aria-hidden="true"/>
  </button>
  {open&&<div className="fnlAccountDropdown" role="menu">
   <div className="fnlAccountSummary"><strong>{me.name}</strong><small>{me.email}</small><small>{me.roles.join(', ')||'User'}</small></div>
   <Link role="menuitem" href="/settings" onClick={()=>setOpen(false)}><UserRound size={17}/> My profile</Link>
   <Link role="menuitem" href="/settings" onClick={()=>setOpen(false)}><Settings size={17}/> Account settings</Link>
   <button type="button" role="menuitem" onClick={signOut} disabled={busy}><LogOut size={17}/>{busy?'Signing out…':'Sign out'}</button>
  </div>}
 </div>
}
