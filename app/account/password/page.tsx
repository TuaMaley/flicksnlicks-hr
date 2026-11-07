'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
export default function ChangePasswordPage(){
 const router=useRouter();
 const [currentPassword,setCurrent]=useState('');
 const [newPassword,setNext]=useState('');
 const [confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setError('');
  if(newPassword.length<12||newPassword.length>128){setError('Use a password of 12–128 characters.');return}
  if(newPassword!==confirm){setError('New passwords do not match.');return}
  if(currentPassword===newPassword){setError('Choose a different password.');return}
  setBusy(true);
  try{
   const response=await fetch('/api/account/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});
   const data=await response.json();
   if(!response.ok){setError(data.error||'Unable to change password.');return}
   setCurrent('');setNext('');setConfirm('');setSuccess(true);
   router.refresh();
  }catch{setError('Network error. Please try again.')}finally{setBusy(false)}
 }
 return <main style={{maxWidth:580,margin:'40px auto',padding:24}}><section className="workCard" style={{padding:28}}>
  <h1>Change password</h1><p>Protect your Nexora account by using a unique password of at least 12 characters.</p>
  {success?<div role="status"><p>Password changed successfully. For security, you have been signed out.</p><Link href="/login">Sign in with your new password</Link></div>:<form onSubmit={submit} style={{display:'grid',gap:16}}>
   <label>Current password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>
   <label>New password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e=>setNext(e.target.value)}/></label>
   <label>Confirm new password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
   <button className="primaryBtn" type="submit" disabled={busy}>{busy?'Saving…':'Change password'}</button>
   <p><Link href="/forgot-password">Forgot your current password?</Link></p>
  </form>}
 </section></main>
}
