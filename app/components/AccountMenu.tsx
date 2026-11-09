'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import Link from 'next/link';
import {ChevronDown,LogOut,Settings,UserRound} from 'lucide-react';

type Me={name:string;email:string;roles:string[];profilePhotoDataUrl:string|null};
export default function AccountMenu(){
 const pathname=usePathname(),router=useRouter();
 const [me,setMe]=useState<Me|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [companyName,setCompanyName]=useState('');
 const wrapper=useRef<HTMLDivElement>(null);
 const refreshProfile=useCallback(async()=>{
   if(pathname==='/login')return;
   try{
    const r=await fetch('/api/me',{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    setMe({name:data.name,email:data.email,roles:data.roles||[],profilePhotoDataUrl:data.profilePhotoDataUrl||null});
   }catch{/* Retain the last known account details during a temporary network failure. */}
 },[pathname]);
 useEffect(()=>{
   if(pathname==='/login'){setMe(null);return;}
   void refreshProfile();
   const onFocus=()=>void refreshProfile();
   const onVisibility=()=>{if(document.visibilityState==='visible')void refreshProfile()};
   const onProfileUpdated=()=>void refreshProfile();
   window.addEventListener('focus',onFocus);
   window.addEventListener('nexora:profile-photo-updated',onProfileUpdated);
   document.addEventListener('visibilitychange',onVisibility);
   // Also catch uploads made within ESS without a custom event from that screen.
   const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void refreshProfile()},5000);
   return ()=>{
    window.removeEventListener('focus',onFocus);
    window.removeEventListener('nexora:profile-photo-updated',onProfileUpdated);
    document.removeEventListener('visibilitychange',onVisibility);
    window.clearInterval(interval);
   };
 },[pathname,refreshProfile]);
 useEffect(()=>{
   let active=true;
   if(pathname==='/login'||pathname==='/platform'||pathname.startsWith('/platform/')){
     setCompanyName('');
     return ()=>{active=false};
   }
   const refreshCompany=async()=>{
     try{
       const response=await fetch('/api/company-context',{cache:'no-store'});
       if(!response.ok){if(active)setCompanyName('');return;}
       const data=await response.json();
       const company=(data.companies||[]).find((entry:{id:string;name:string})=>entry.id===data.activeCompanyId);
       if(active)setCompanyName(typeof company?.name==='string'?company.name:'');
     }catch{if(active)setCompanyName('');}
   };
   void refreshCompany();
   window.addEventListener('focus',refreshCompany);
   return ()=>{active=false;window.removeEventListener('focus',refreshCompany)};
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
 return <div className="fnlAccountDock" ref={wrapper} style={{display:'flex',alignItems:'center',gap:12}}>
  {companyName&&<div aria-label={'Current company: '+companyName} title={companyName} style={{display:'flex',alignItems:'center',gap:7,maxWidth:260,minWidth:0,padding:'8px 12px',border:'1px solid #e0e5ee',borderRadius:10,background:'#fff',fontSize:13,fontWeight:700,color:'#1f2937'}}><span aria-hidden="true" style={{fontSize:16}}>🏢</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{companyName}</span></div>}
  <button type="button" className="fnlAccountTrigger" aria-label="Account menu" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(v=>!v)}>
   <span className="fnlAccountAvatar" style={{overflow:"hidden",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{me.profilePhotoDataUrl?<img src={me.profilePhotoDataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}}/>:initials}</span>
   <span className="fnlAccountIdentity"><strong>{me.name}</strong><small>Signed in</small></span>
   <ChevronDown size={17} aria-hidden="true"/>
  </button>
  {open&&<div className="fnlAccountDropdown" role="menu">
   <div className="fnlAccountSummary"><strong>{me.name}</strong><small>{me.email}</small><small>{me.roles.join(', ')||'User'}</small></div>
   <Link role="menuitem" href="/profile" onClick={()=>setOpen(false)}><UserRound size={17}/> My profile</Link>
   <Link role="menuitem" href="/settings" onClick={()=>setOpen(false)}><Settings size={17}/> Account settings</Link>
   <button type="button" role="menuitem" onClick={signOut} disabled={busy}><LogOut size={17}/>{busy?'Signing out…':'Sign out'}</button>
  </div>}
 </div>
}
