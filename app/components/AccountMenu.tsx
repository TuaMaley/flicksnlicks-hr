'use client';
import {displayRoleName, displayRoleNames} from '../../lib/displayRoleName';

import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import Link from 'next/link';
import {ChevronDown,LogOut,Settings,UserRound} from 'lucide-react';

type Me={name:string;email:string;roles:string[];profilePhotoDataUrl:string|null};
export default function AccountMenu(){
 const pathname=usePathname(),router=useRouter();
 const [me,setMe]=useState<Me|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
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
   <span className="fnlAccountAvatar" style={{overflow:"hidden",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{me.profilePhotoDataUrl?<img src={me.profilePhotoDataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}}/>:initials}</span>
   <span className="fnlAccountIdentity"><strong>{me.name}</strong><small>Signed in</small></span>
   <ChevronDown size={17} aria-hidden="true"/>
  </button>
  {open&&<div className="fnlAccountDropdown" role="menu">
   <div className="fnlAccountSummary"><strong>{me.name}</strong><small>{me.email}</small><small>{displayRoleNames(me.roles)||'User'}</small></div>
   <Link role="menuitem" href="/profile" onClick={()=>setOpen(false)}><UserRound size={17}/> My profile</Link>
   <Link role="menuitem" href="/settings" onClick={()=>setOpen(false)}><Settings size={17}/> Account settings</Link>
   <button type="button" role="menuitem" onClick={signOut} disabled={busy}><LogOut size={17}/>{busy?'Signing out…':'Sign out'}</button>
  </div>}
 </div>
}
