'use client';
import {useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import '../login/nexora-login.css';
export default function ForgotPassword(){
 const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});}finally{setBusy(false);setDone(true)}}
 return <main className="nexoraLoginPage"><section className="nexoraLoginCard"><div className="nexoraLoginBrands"><div className="nexoraLoginNexora"><Image src="/nexora-login-brand.png" alt="Nexora" width={380} height={190}/></div></div><h1>Forgot password?</h1><p className="nexoraLoginSubtitle">Enter your Nexora account email to receive a reset link.</p>{done?<p role="status">If an active account exists for this email, a reset link will be sent. Please check your inbox.</p>:<form onSubmit={submit}><label className="nexoraLoginLabel">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="nexoraLoginButton" disabled={busy}>{busy?'Sending…':'Send reset link'}</button></form>}<p style={{textAlign:'center',marginTop:24}}><Link href="/login">Back to sign in</Link></p></section></main>;
}
