'use client';

import './nexora-login.css';
import { useState } from 'react';
import Image from 'next/image';
export default function Login(){const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw Error(d.error||'Sign in failed');location.href='/'}catch(e:any){setError(e.message)}finally{setLoading(false)}}return <main className="nexoraLoginPage">
  <div className="nexoraLoginRibbon nexoraLoginRibbonOne" aria-hidden="true" />
  <div className="nexoraLoginRibbon nexoraLoginRibbonTwo" aria-hidden="true" />
  <form className="nexoraLoginCard" onSubmit={submit}>
    <div className="nexoraLoginBrands">
      <div className="nexoraLoginFlicks"><Image src="/nexora-login-flicks.png" alt="Flicks & Licks" width={110} height={110} priority /></div>
      <span className="nexoraLoginDivider" aria-hidden="true" />
      <div className="nexoraLoginNexora"><Image src="/nexora-login-brand.png" alt="Nexora — People, Performance, Growth" width={380} height={190} priority /></div>
    </div>
    <h1>Welcome back</h1>
    <p className="nexoraLoginSubtitle">Sign in to Flicks &amp; Licks HR Management (Nexora)</p>
    <label className="nexoraLoginLabel">Email address
      <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" />
    </label>
    <label className="nexoraLoginLabel">Password
      <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
    </label>
    {error&&<div className="formError nexoraLoginError" role="alert">{error}</div>}
    <button type="submit" className="nexoraLoginButton" disabled={loading}>{loading?'Signing in…':'Sign in'}</button>
    <small className="nexoraLoginNotice">Authorized personnel only <span aria-hidden="true">•</span> Your access is recorded</small>
  </form>
</main>;}
