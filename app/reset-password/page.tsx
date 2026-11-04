'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {Suspense} from 'react';
import '../login/nexora-login.css';
function ResetForm(){const token=useSearchParams().get('token')||'';const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match');return}setBusy(true);try{const res=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to reset password');setDone(true)}catch(e){setError(e instanceof Error?e.message:'Unable to reset password')}finally{setBusy(false)}}
 return <main className="nexoraLoginPage"><section className="nexoraLoginCard"><div className="nexoraLoginBrands"><div className="nexoraLoginNexora"><Image src="/nexora-login-brand.png" alt="Nexora" width={380} height={190}/></div></div><h1>Reset password</h1>{done?<p role="status">Your password has been updated. <Link href="/login">Sign in</Link>.</p>:!token?<p>This link is missing a reset token. <Link href="/forgot-password">Request a new link</Link>.</p>:<form onSubmit={submit}><p className="nexoraLoginSubtitle">Choose a new password (at least 12 characters).</p><label className="nexoraLoginLabel">New password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="nexoraLoginLabel">Confirm password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}<button className="nexoraLoginButton" disabled={busy}>{busy?'Updating…':'Reset password'}</button></form>}<p style={{textAlign:'center',marginTop:24}}><Link href="/login">Back to sign in</Link></p></section></main>;
}
export default function ResetPassword(){return <Suspense fallback={<p>Loading…</p>}><ResetForm/></Suspense>}
