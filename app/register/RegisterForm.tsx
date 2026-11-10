'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,MailCheck} from 'lucide-react';
import {Field} from '../_site/SiteFrame';
import type {PublicPlan} from '../_site/plans';
import {COMPANY_TYPES,EMPLOYEE_BANDS,INDUSTRIES,MODULE_LABELS} from '../../lib/onboarding/constants';

const STEPS=['Business','Registration','People','Plan','Review'];
const TITLES=['About your business','Registration and address','Contact person and administrator','Choose your plan','Check and submit'];
const STEP_OF:Record<string,number>={companyName:0,companyType:0,industry:0,employeeBand:0,companyEmail:0,companyPhone:0,website:0,registrationNumber:1,taxIdentifier:1,businessAddress:1,digitalAddress:1,city:1,contactName:2,contactPosition:2,contactPhone:2,contactEmail:2,adminName:2,adminEmail:2,adminPhone:2,adminJobTitle:2,planId:3,billingCycle:3,notes:4,acceptTerms:4};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GPS=/^[A-Z]{2}-?\d{3,4}-?\d{4}$/i;
const fmt=(n:number,c:string)=>(c==='GHS'?'GH₵':c==='USD'?'$':c+' ')+n.toLocaleString('en-GH',{maximumFractionDigits:2});

export default function RegisterForm({plans,initialPlan,initialCycle}:{plans:PublicPlan[];initialPlan:string;initialCycle:'MONTHLY'|'ANNUAL'}){
 const [step,setStep]=useState(0);
 const [v,setV]=useState({companyName:'',companyType:'',industry:'',employeeBand:'',companyEmail:'',companyPhone:'',website:'',
  registrationNumber:'',taxIdentifier:'',businessAddress:'',digitalAddress:'',city:'',
  contactName:'',contactPosition:'',contactPhone:'',contactEmail:'',adminSame:true,adminName:'',adminEmail:'',adminPhone:'',adminJobTitle:'',
  planId:initialPlan||(plans.length===1?plans[0].id:''),billingCycle:initialCycle,notes:'',acceptTerms:false,website_url:''});
 const [errors,setErrors]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState<{reference:string|null}|null>(null);
 const started=useRef(0);useEffect(()=>{started.current=Date.now()},[]);
 const heading=useRef<HTMLHeadingElement>(null),mounted=useRef(false);
 useEffect(()=>{if(!mounted.current){mounted.current=true;return}heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'smooth'})},[step,done]);
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(x=>({...x,[k]:e.target.type==='checkbox'?(e.target as HTMLInputElement).checked:e.target.value}));
 const inv=(k:string)=>({'aria-invalid':Boolean(errors[k]),'aria-describedby':errors[k]?k+'-err':undefined});
 const plan=plans.find(p=>p.id===v.planId);
 const admin=v.adminSame?{adminName:v.contactName,adminEmail:v.contactEmail,adminPhone:v.contactPhone,adminJobTitle:v.contactPosition}:{adminName:v.adminName,adminEmail:v.adminEmail,adminPhone:v.adminPhone,adminJobTitle:v.adminJobTitle};
 const t=(s:string)=>s.trim();

 function check(s:number){const e:Record<string,string>={};
  if(s===0){if(t(v.companyName).length<2)e.companyName='Enter your company name.';if(!v.companyType)e.companyType='Choose a company type.';if(!v.industry)e.industry='Choose an industry.';if(!EMAIL.test(t(v.companyEmail)))e.companyEmail='Enter a valid company email address.';if(t(v.companyPhone).length<7)e.companyPhone='Enter the company phone number.'}
  if(s===1){if(t(v.registrationNumber).length<3)e.registrationNumber='Enter your business registration number.';if(t(v.taxIdentifier).length<6)e.taxIdentifier='Enter a Ghana Card number or TIN.';if(t(v.businessAddress).length<5)e.businessAddress='Enter your business address.';if(!GPS.test(t(v.digitalAddress).replace(/\s/g,'')))e.digitalAddress='Enter a GhanaPost GPS address such as GA-123-4567.'}
  if(s===2){if(t(v.contactName).length<2)e.contactName='Enter the contact person’s name.';if(t(v.contactPosition).length<2)e.contactPosition='Enter their position.';if(t(v.contactPhone).length<7)e.contactPhone='Enter their phone number.';if(!EMAIL.test(t(v.contactEmail)))e.contactEmail='Enter a valid email address.';
   if(!v.adminSame){if(t(v.adminName).length<2)e.adminName='Enter the administrator’s name.';if(!EMAIL.test(t(v.adminEmail)))e.adminEmail='Enter a valid email address.'}}
  if(s===3&&!v.planId)e.planId='Choose a plan.';
  if(s===4&&!v.acceptTerms)e.acceptTerms='Accept the terms and privacy notice to continue.';
  setErrors(e);return !Object.keys(e).length}
 function next(e:React.FormEvent){e.preventDefault();setError('');if(!check(step))return;if(step<STEPS.length-1){setStep(step+1);return}void submit()}
 async function submit(){setBusy(true);setError('');try{
  const {adminSame:_,...rest}=v;
  const r=await fetch('/api/public/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...rest,...admin,startedAt:started.current})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const f:Record<string,string>={...(d.fields||{})};if(v.adminSame)for(const [a,c] of [['adminName','contactName'],['adminEmail','contactEmail'],['adminPhone','contactPhone']])if(f[a]&&!f[c])f[c]=f[a];setErrors(f);const first=Object.keys(f).map(k=>STEP_OF[k]).filter(n=>n!==undefined).sort((a,b)=>a-b)[0];if(first!==undefined)setStep(first);throw Error(d.error||'Your registration was not sent. Try again.')}
  setDone({reference:d.reference??null});
 }catch(err:any){setError(err.message)}finally{setBusy(false)}}

 if(done)return <div className="done-card"><span className="ico"><MailCheck size={26} aria-hidden="true"/></span><h2 ref={heading} tabIndex={-1} style={{fontSize:32,outline:'none'}}>Check your inbox</h2><p className="lede" style={{fontSize:18}}>We sent a confirmation link to <b>{admin.adminEmail}</b>. Open it within 48 hours so we can start reviewing your registration.</p>{done.reference&&<p style={{marginTop:18}}>Your reference: <b className="num">{done.reference}</b></p>}<p style={{marginTop:18,color:'var(--muted)'}}>No email after a few minutes? Check your spam folder, or <a className="textlink" href="/contact">contact us</a> with your company name.</p></div>;

 return <form onSubmit={next} noValidate>
  <ol className="stepper" aria-label="Registration steps">{STEPS.map((s,i)=><li key={s} aria-current={i===step?'step':undefined} className={i<step?'done':''}><span>{s}</span></li>)}</ol>
  <p style={{fontSize:14,color:'var(--muted)',marginBottom:6}}>Step {step+1} of {STEPS.length}</p>
  <h2 ref={heading} tabIndex={-1} style={{fontSize:28,marginBottom:24,outline:'none',scrollMarginTop:100}}>{TITLES[step]}</h2>
  {error&&<div className="alert" role="alert">{error}</div>}

  {step===0&&<div className="formgrid">
   <Field id="companyName" label="Company name" error={errors.companyName} full><input id="companyName" autoComplete="organization" maxLength={120} value={v.companyName} onChange={set('companyName')} {...inv('companyName')}/></Field>
   <Field id="companyType" label="Company type" error={errors.companyType}><select id="companyType" value={v.companyType} onChange={set('companyType')} {...inv('companyType')}><option value="">Select</option>{COMPANY_TYPES.map(i=><option key={i}>{i}</option>)}</select></Field>
   <Field id="industry" label="Industry" error={errors.industry}><select id="industry" value={v.industry} onChange={set('industry')} {...inv('industry')}><option value="">Select</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}</select></Field>
   <Field id="companyEmail" label="Company email" error={errors.companyEmail} hint="Used for invoices and account notices"><input id="companyEmail" type="email" autoComplete="email" maxLength={254} value={v.companyEmail} onChange={set('companyEmail')} {...inv('companyEmail')}/></Field>
   <Field id="companyPhone" label="Company phone" error={errors.companyPhone}><input id="companyPhone" type="tel" autoComplete="tel" maxLength={40} placeholder="030 000 0000" value={v.companyPhone} onChange={set('companyPhone')} {...inv('companyPhone')}/></Field>
   <Field id="employeeBand" label="Number of employees" optional error={errors.employeeBand}><select id="employeeBand" value={v.employeeBand} onChange={set('employeeBand')}><option value="">Select</option>{EMPLOYEE_BANDS.map(i=><option key={i}>{i}</option>)}</select></Field>
   <Field id="website" label="Website" optional error={errors.website}><input id="website" inputMode="url" maxLength={200} placeholder="example.com" value={v.website} onChange={set('website')} {...inv('website')}/></Field>
  </div>}

  {step===1&&<div className="formgrid">
   <Field id="registrationNumber" label="Business registration number" error={errors.registrationNumber} hint="From the Office of the Registrar of Companies, e.g. CS123456789"><input id="registrationNumber" maxLength={40} autoCapitalize="characters" value={v.registrationNumber} onChange={set('registrationNumber')} {...inv('registrationNumber')}/></Field>
   <Field id="taxIdentifier" label="Ghana Card / TIN number" error={errors.taxIdentifier} hint="GHA-XXXXXXXXX-X or your TIN"><input id="taxIdentifier" maxLength={30} autoCapitalize="characters" value={v.taxIdentifier} onChange={set('taxIdentifier')} {...inv('taxIdentifier')}/></Field>
   <Field id="businessAddress" label="Business address" error={errors.businessAddress} full><input id="businessAddress" autoComplete="street-address" maxLength={500} value={v.businessAddress} onChange={set('businessAddress')} {...inv('businessAddress')}/></Field>
   <Field id="digitalAddress" label="Digital address (GhanaPost GPS)" error={errors.digitalAddress} hint="For example GA-123-4567"><input id="digitalAddress" maxLength={20} autoCapitalize="characters" value={v.digitalAddress} onChange={set('digitalAddress')} {...inv('digitalAddress')}/></Field>
   <Field id="city" label="City or town" optional><input id="city" autoComplete="address-level2" maxLength={80} value={v.city} onChange={set('city')}/></Field>
  </div>}

  {step===2&&<>
   <p className="fieldset-title">Contact person</p>
   <div className="formgrid">
    <Field id="contactName" label="Full name" error={errors.contactName}><input id="contactName" autoComplete="name" maxLength={120} value={v.contactName} onChange={set('contactName')} {...inv('contactName')}/></Field>
    <Field id="contactPosition" label="Position" error={errors.contactPosition}><input id="contactPosition" autoComplete="organization-title" maxLength={120} placeholder="e.g. HR Manager" value={v.contactPosition} onChange={set('contactPosition')} {...inv('contactPosition')}/></Field>
    <Field id="contactPhone" label="Phone" error={errors.contactPhone}><input id="contactPhone" type="tel" autoComplete="tel" maxLength={40} value={v.contactPhone} onChange={set('contactPhone')} {...inv('contactPhone')}/></Field>
    <Field id="contactEmail" label="Email" error={errors.contactEmail}><input id="contactEmail" type="email" autoComplete="email" maxLength={254} value={v.contactEmail} onChange={set('contactEmail')} {...inv('contactEmail')}/></Field>
   </div>
   <p className="fieldset-title">First administrator</p>
   <label className="check"><input type="checkbox" checked={v.adminSame} onChange={set('adminSame')}/><span>The contact person will administer Nexora. Their email becomes the administrator sign-in and receives the confirmation link.</span></label>
   {!v.adminSame&&<div className="formgrid" style={{marginTop:20}}>
    <Field id="adminName" label="Administrator’s full name" error={errors.adminName}><input id="adminName" maxLength={120} value={v.adminName} onChange={set('adminName')} {...inv('adminName')}/></Field>
    <Field id="adminJobTitle" label="Job title" optional><input id="adminJobTitle" maxLength={120} value={v.adminJobTitle} onChange={set('adminJobTitle')}/></Field>
    <Field id="adminEmail" label="Administrator’s email" error={errors.adminEmail} hint="Their sign-in; the confirmation link goes here"><input id="adminEmail" type="email" maxLength={254} value={v.adminEmail} onChange={set('adminEmail')} {...inv('adminEmail')}/></Field>
    <Field id="adminPhone" label="Phone" optional error={errors.adminPhone}><input id="adminPhone" type="tel" maxLength={40} value={v.adminPhone} onChange={set('adminPhone')} {...inv('adminPhone')}/></Field>
   </div>}
  </>}

  {step===3&&<>
   <div className="toggle" role="group" aria-label="Billing period"><button type="button" aria-pressed={v.billingCycle==='MONTHLY'} onClick={()=>setV(x=>({...x,billingCycle:'MONTHLY'}))}>Monthly</button><button type="button" aria-pressed={v.billingCycle==='ANNUAL'} onClick={()=>setV(x=>({...x,billingCycle:'ANNUAL'}))}>Annual</button></div>
   <fieldset style={{border:0,padding:0,margin:0}}><legend className="hp">Plan</legend><div className="planpick">{plans.map(p=>{const price=v.billingCycle==='MONTHLY'?p.monthlyPrice:p.annualPrice;return <label key={p.id}><input type="radio" name="plan" value={p.id} checked={v.planId===p.id} onChange={set('planId')}/><b>{p.name}</b><small className="num">{price>0?`${fmt(price,p.currency)} per ${v.billingCycle==='MONTHLY'?'month':'year'}`:'Custom pricing'}</small><small>{p.modules.length} modules</small></label>})}</div></fieldset>
   {errors.planId&&<p className="field" style={{marginTop:10}}><span className="err" id="planId-err" role="alert">{errors.planId}</span></p>}
   {plan&&<p style={{marginTop:20,color:'var(--muted)'}}>Includes {plan.modules.map(k=>MODULE_LABELS[k]).join(', ')}. <a className="textlink" href="/pricing" target="_blank" rel="noopener">Compare plans</a></p>}
  </>}

  {step===4&&<>
   <dl className="review">
    <dt>Company</dt><dd>{v.companyName} · {v.companyType}</dd>
    <dt>Registration no.</dt><dd>{v.registrationNumber.toUpperCase()}</dd>
    <dt>Ghana Card / TIN</dt><dd>{v.taxIdentifier.toUpperCase()}</dd>
    <dt>Address</dt><dd>{[v.businessAddress,v.city].filter(Boolean).join(', ')} · {v.digitalAddress.toUpperCase()}</dd>
    <dt>Contact person</dt><dd>{v.contactName}, {v.contactPosition}</dd>
    <dt>Administrator</dt><dd>{admin.adminName} — {admin.adminEmail}</dd>
    <dt>Plan</dt><dd>{plan?.name} · {v.billingCycle==='MONTHLY'?'monthly':'annual'} billing</dd>
   </dl>
   <div className="field" style={{marginTop:24}}><label htmlFor="notes">Anything we should know? <span className="opt">(optional)</span></label><textarea id="notes" maxLength={1000} value={v.notes} onChange={set('notes')} placeholder="For example: number of branches, or when you would like to start"/></div>
   <div style={{marginTop:22}}><label className="check"><input type="checkbox" checked={v.acceptTerms} onChange={set('acceptTerms')} {...inv('acceptTerms')}/><span>I am authorised to register this company and I accept the <a href="/terms" target="_blank" rel="noopener">terms of service</a> and <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.</span></label>{errors.acceptTerms&&<p className="field" style={{marginTop:8}}><span className="err" id="acceptTerms-err" role="alert">{errors.acceptTerms}</span></p>}</div>
  </>}

  <div className="hp" aria-hidden="true"><label htmlFor="website_url">Leave this empty</label><input id="website_url" tabIndex={-1} autoComplete="off" value={v.website_url} onChange={set('website_url')}/></div>
  <div className="formnav">{step>0?<button type="button" className="btn btn-line" onClick={()=>{setErrors({});setStep(step-1)}}><ArrowLeft size={18} aria-hidden="true"/>Back</button>:<span/>}<button className="btn btn-red" disabled={busy}>{busy?'Submitting…':step<STEPS.length-1?<>Continue <ArrowRight size={18} aria-hidden="true"/></>:'Submit registration'}</button></div>
 </form>;
}
