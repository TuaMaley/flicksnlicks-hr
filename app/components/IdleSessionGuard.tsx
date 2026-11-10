'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
const LIMIT=10*60*1000,WARNING=2*60*1000,KEY='nexora:last-user-activity';
const publicPaths=['/login','/forgot-password','/reset-password','/platform-invite',
 // Public website and onboarding pages (no session to guard)
 '/welcome','/features','/pricing','/about','/contact','/request-demo','/register','/accept-invitation','/terms','/privacy'];
export default function IdleSessionGuard({bare=false}:{bare?:boolean}){
 const path=usePathname()||'/';const isPublic=bare||publicPaths.some(p=>path===p||path.startsWith(p+'/'));const [remaining,setRemaining]=useState(LIMIT);const [expired,setExpired]=useState(false);
 useEffect(()=>{
  if(isPublic)return;
  let last=Date.now(),lastTouch=0,closed=false,signingOut=false;
  try{const saved=Number(localStorage.getItem(KEY));if(saved>0&&saved<=Date.now()&&Date.now()-saved<LIMIT)last=saved;else localStorage.setItem(KEY,String(last))}catch{}
  const logout=async()=>{if(signingOut)return;signingOut=true;setExpired(true);try{await fetch('/api/auth/logout',{method:'POST',cache:'no-store'})}catch{}window.location.replace('/login?reason=inactive')};
  const touch=async()=>{if(closed||signingOut)return;const now=Date.now();if(now-lastTouch<15000)return;lastTouch=now;try{const r=await fetch('/api/auth/activity',{method:'POST',cache:'no-store'});if(r.status===401)logout()}catch{ /* network failure must not extend server session */ }};
  const activity=()=>{if(signingOut)return;last=Date.now();try{localStorage.setItem(KEY,String(last))}catch{}setRemaining(LIMIT);void touch()};
  const storage=(e:StorageEvent)=>{if(e.key===KEY&&e.newValue){const n=Number(e.newValue);if(n>last&&n<=Date.now())last=n}};
  const check=async()=>{if(closed||signingOut)return;const elapsed=Date.now()-last;setRemaining(Math.max(0,LIMIT-elapsed));if(elapsed>=LIMIT){void logout();return}if(document.visibilityState==='visible'){try{const r=await fetch('/api/auth/activity',{cache:'no-store'});if(r.status===401)void logout()}catch{}}};
  const keep=()=>activity();window.addEventListener('nexora-keep-session',keep);
  const events=['pointerdown','keydown','touchstart','scroll'];
  events.forEach(e=>window.addEventListener(e,activity,{passive:true}));window.addEventListener('storage',storage);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
  const timer=window.setInterval(check,10000);void check();
  return()=>{closed=true;window.removeEventListener('nexora-keep-session',keep);window.clearInterval(timer);events.forEach(e=>window.removeEventListener(e,activity));window.removeEventListener('storage',storage);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)};
 },[path,isPublic]);
 if(isPublic||expired||remaining>WARNING)return null;
 return <div role="alertdialog" aria-modal="true" aria-label="Session expiring" style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(15,23,42,.55)',display:'grid',placeItems:'center',padding:20}}><div style={{background:'#fff',borderRadius:14,padding:28,maxWidth:420,width:'100%',boxShadow:'0 20px 60px #0003'}}><h2 style={{marginTop:0}}>Your session is about to expire</h2><p>You have been inactive. Nexora will sign you out in {Math.ceil(remaining/1000)} seconds.</p><button type="button" style={{background:'#c8102e',color:'white',border:0,borderRadius:8,padding:'12px 18px',cursor:'pointer'}} onClick={()=>{window.dispatchEvent(new Event('nexora-keep-session'));}}>Stay signed in</button></div></div>;
}
