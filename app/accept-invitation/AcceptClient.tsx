'use client';
import {useEffect,useState} from 'react';
import PasswordInput from '../components/PasswordInput';
type Inv={companyName:string;companyCode:string;adminName:string;email:string};
export default function AcceptClient(){
 const [token,setToken]=useState(''),[inv,setInv]=useState<Inv|null>(null),[loadError,setLoadError]=useState('');
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState<string|null>(null);
 useEffect(()=>{const t=new URLSearchParams(window.location.search).get('token')||'';setToken(t);if(!t){setLoadError('This invitation link is incomplete. Open the link from your email again.');return}
  fetch('/api/public/invitation?token='+encodeURIComponent(t),{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'This invitation cannot be used.');setInv(d)}).catch(e=>setLoadError(e.message))},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');if(password.length<12){setError('Use at least 12 characters.');return}if(password!==confirm){setError('The two passwords do not match.');return}
  setBusy(true);try{const r=await fetch('/api/public/invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Activation failed.');setDone(d.email);window.history.replaceState(null,'','/accept-invitation')}catch(err:any){setError(err.message)}finally{setBusy(false)}}
 if(done)return <><h1 style={{fontSize:'clamp(32px,4vw,48px)'}}>{inv?.companyName} is live</h1><p className="lede">Your workspace is active and your subscription has started. Sign in with {done} to add branches, invite your HR team and import employees.</p><div className="actions"><a className="btn btn-red" href="/login">Sign in</a></div></>;
 if(loadError)return <><h1 style={{fontSize:'clamp(32px,4vw,48px)'}}>Invitation not available</h1><div className="alert" role="alert" style={{marginTop:24}}>{loadError}</div><div className="actions"><a className="btn btn-ink" href="/login">Sign in</a><a className="btn btn-line" href="/contact">Contact us</a></div></>;
 if(!inv)return <p>Checking your invitation…</p>;
 return <form onSubmit={submit} noValidate>
  <h1 style={{fontSize:'clamp(32px,4vw,48px)'}}>Activate {inv.companyName}</h1>
  <p className="lede">Hello {inv.adminName}. Set a password for <b>{inv.email}</b> to activate your company’s workspace ({inv.companyCode}).</p>
  {error&&<div className="alert" role="alert" style={{marginTop:24}}>{error}</div>}
  <div style={{display:'grid',gap:18,marginTop:28}}>
   <div className="field"><label htmlFor="pw">New password</label><PasswordInput id="pw" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><span className="hint">At least 12 characters. A short phrase is easier to remember.</span></div>
   <div className="field"><label htmlFor="pw2">Confirm password</label><PasswordInput id="pw2" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>
  </div>
  <div className="actions"><button className="btn btn-red" disabled={busy}>{busy?'Activating…':'Activate workspace'}</button></div>
  <p className="note" style={{fontSize:14}}>Your subscription starts when you activate. This link works once.</p>
 </form>;
}
