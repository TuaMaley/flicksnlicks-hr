'use client';
// Demo request (kind DEMO) and contact (kind CONTACT) form. Posts to /api/public/leads.
import {useEffect,useRef,useState} from 'react';
import {Field} from './SiteFrame';
import {CONTACT_TOPICS,EMPLOYEE_BANDS} from '../../lib/onboarding/constants';
export default function LeadForm({kind}:{kind:'DEMO'|'CONTACT'}){
 const [v,setV]=useState({name:'',email:'',phone:'',companyName:'',jobTitle:'',country:'Ghana',employeeBand:'',topic:kind==='CONTACT'?'Sales':'',message:'',preferredTime:'',website_url:''});
 const [errors,setErrors]=useState<Record<string,string>>({}),[error,setError]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false);
 const started=useRef(0);useEffect(()=>{started.current=Date.now()},[]);
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(x=>({...x,[k]:e.target.value}));
 const inv=(k:string)=>({'aria-invalid':Boolean(errors[k]),'aria-describedby':errors[k]?k+'-err':undefined});
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setErrors({});try{const r=await fetch('/api/public/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...v,kind,startedAt:started.current})});const d=await r.json().catch(()=>({}));if(!r.ok){setErrors(d.fields||{});throw Error(d.error||'Your message was not sent. Try again.')}setDone(d.message||'Sent.')}catch(err:any){setError(err.message)}finally{setBusy(false)}}
 if(done)return <div className="alert ok" role="status"><b>{kind==='DEMO'?'Demo request sent.':'Message sent.'}</b> {done} A confirmation is on its way to {v.email}.</div>;
 return <form onSubmit={submit} noValidate>
  {error&&<div className="alert" role="alert">{error}</div>}
  <div className="formgrid">
   <Field id="name" label="Your name" error={errors.name}><input id="name" required autoComplete="name" maxLength={120} value={v.name} onChange={set('name')} {...inv('name')}/></Field>
   <Field id="email" label="Work email" error={errors.email}><input id="email" type="email" required autoComplete="email" maxLength={254} value={v.email} onChange={set('email')} {...inv('email')}/></Field>
   <Field id="phone" label="Phone" optional error={errors.phone}><input id="phone" type="tel" autoComplete="tel" maxLength={40} value={v.phone} onChange={set('phone')} {...inv('phone')}/></Field>
   <Field id="companyName" label="Company" optional={kind==='CONTACT'} error={errors.companyName}><input id="companyName" autoComplete="organization" maxLength={120} required={kind==='DEMO'} value={v.companyName} onChange={set('companyName')} {...inv('companyName')}/></Field>
   {kind==='DEMO'&&<><Field id="jobTitle" label="Your role" optional><input id="jobTitle" autoComplete="organization-title" maxLength={120} value={v.jobTitle} onChange={set('jobTitle')}/></Field>
   <Field id="employeeBand" label="Number of employees" optional error={errors.employeeBand}><select id="employeeBand" value={v.employeeBand} onChange={set('employeeBand')}><option value="">Select</option>{EMPLOYEE_BANDS.map(b=><option key={b}>{b}</option>)}</select></Field>
   <Field id="country" label="Country" optional><input id="country" autoComplete="country-name" maxLength={80} value={v.country} onChange={set('country')}/></Field>
   <Field id="preferredTime" label="Best time to reach you" optional hint="For example: weekday mornings"><input id="preferredTime" maxLength={120} value={v.preferredTime} onChange={set('preferredTime')}/></Field></>}
   {kind==='CONTACT'&&<Field id="topic" label="What is it about?" error={errors.topic}><select id="topic" value={v.topic} onChange={set('topic')}>{CONTACT_TOPICS.map(t=><option key={t}>{t}</option>)}</select></Field>}
   <Field id="message" full label={kind==='DEMO'?'What would you like to see?':'Message'} optional={kind==='DEMO'} error={errors.message}><textarea id="message" maxLength={2000} required={kind==='CONTACT'} value={v.message} onChange={set('message')} {...inv('message')} placeholder={kind==='DEMO'?'For example: payroll for two branches, leave approvals, moving from spreadsheets':''}/></Field>
  </div>
  <div className="hp" aria-hidden="true"><label htmlFor="website_url">Leave this empty</label><input id="website_url" tabIndex={-1} autoComplete="off" value={v.website_url} onChange={set('website_url')}/></div>
  <div className="actions"><button className="btn btn-red" disabled={busy}>{busy?'Sending…':kind==='DEMO'?'Request demo':'Send message'}</button></div>
  <p className="note" style={{fontSize:14}}>We use these details only to reply to you. See our <a href="/privacy">privacy notice</a>.</p>
 </form>;
}
