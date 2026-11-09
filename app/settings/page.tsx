'use client';
import PasswordInput from '../components/PasswordInput';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Me={name:string;email:string;roles:string[]};
export default function SettingsPage(){
 const [me,setMe]=useState<Me|null>(null),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/me',{cache:'no-store'}).then(async r=>{if(r.status===401){location.href='/login';return null}if(!r.ok)throw Error('Could not load account');return r.json()}).then(setMe).catch(e=>setError(e.message))},[]);
 async function changePassword(e:React.FormEvent){
  e.preventDefault();setError('');setMessage('');
  if(next!==confirm){setError('New passwords do not match');return}
  setBusy(true);
  try{
   const r=await fetch('/api/account/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:current,newPassword:next})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to change password');
   setCurrent('');setNext('');setConfirm('');setMessage('Password updated successfully.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to change password')}finally{setBusy(false)}
 }
 return <main className="fnlSettingsPage">
  <Link href="/" className="backLink">← Dashboard</Link><h1>Account settings</h1><p>Manage your Nexora account security and administrative settings.</p>
  <section className="fnlSettingsCard"><h2>Company Administration</h2><p><Link href="/settings/branches">Manage company branches →</Link></p><p><Link href="/settings/departments">Manage company departments →</Link></p><p><Link href="/settings/positions">Manage job positions →</Link></p></section><section className="fnlSettingsCard"><h2>Account identity</h2><dl><dt>Name</dt><dd>{me?.name||'Loading…'}</dd><dt>Email</dt><dd>{me?.email||'—'}</dd><dt>Assigned roles</dt><dd>{me?.roles?.join(', ')||'—'}</dd></dl><p className="fnlMuted">To update your name, email, or assigned roles, contact HR or an Administrator.</p></section>
  <section className="fnlSettingsCard"><h2>Change password</h2><form onSubmit={changePassword}>
   <label>Current password<PasswordInput autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required/></label>
   <label>New password (at least 12 characters)<PasswordInput autoComplete="new-password" minLength={12} value={next} onChange={e=>setNext(e.target.value)} required/></label>
   <label>Confirm new password<PasswordInput autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
   {error&&<p className="fnlError" role="alert">{error}</p>}{message&&<p className="fnlSuccess" role="status">{message}</p>}
   <button className="primaryBtn" disabled={busy}>{busy?'Updating…':'Update password'}</button>
  </form></section>
 </main>
}
