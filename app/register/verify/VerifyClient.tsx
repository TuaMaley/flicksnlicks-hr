'use client';
import {useEffect,useState} from 'react';
// The token is read from the URL and submitted by POST (never confirmed by a plain GET, so link scanners cannot trigger it).
export default function VerifyClient(){
 const [token,setToken]=useState(''),[state,setState]=useState<'ready'|'busy'|'ok'|'error'>('ready'),[msg,setMsg]=useState(''),[ref,setRef]=useState('');
 useEffect(()=>{const t=new URLSearchParams(window.location.search).get('token')||'';setToken(t);if(!t){setState('error');setMsg('This confirmation link is incomplete. Open the link from your email again.')}},[]);
 async function confirm(){setState('busy');try{const r=await fetch('/api/public/register/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'We could not confirm your email.');setRef(d.reference||'');setMsg(d.message);setState('ok');window.history.replaceState(null,'','/register/verify')}catch(e:any){setMsg(e.message);setState('error')}}
 if(state==='ok')return <><h1 style={{fontSize:'clamp(32px,4vw,48px)'}}>Email confirmed</h1><p className="lede">{msg} We will email you when your workspace is ready{ref?<> — reference <b className="num">{ref}</b></>:null}.</p><div className="actions"><a className="btn btn-ink" href="/">Back to the Nexora website</a></div></>;
 return <><h1 style={{fontSize:'clamp(32px,4vw,48px)'}}>Confirm your email</h1>
  {state==='error'?<><div className="alert" role="alert" style={{marginTop:24}}>{msg}</div><div className="actions"><a className="btn btn-red" href="/register">Register again</a><a className="btn btn-line" href="/contact">Contact us</a></div></>
  :<><p className="lede">Confirm this email address to send your company registration to the Nexora team for review.</p><div className="actions"><button type="button" className="btn btn-red" onClick={confirm} disabled={state==='busy'||!token}>{state==='busy'?'Confirming…':'Confirm my email'}</button></div></>}
 </>;
}
