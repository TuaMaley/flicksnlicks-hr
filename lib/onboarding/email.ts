// Phase 17 — transactional email for public registration and onboarding (Resend, same settings as password reset).
import {appOrigin} from '../passwordReset';

export const emailConfigured=()=>Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL);
export function siteOrigin(){return appOrigin()}
/** Internal inbox(es) told about new registrations, demo requests and contact messages. Optional. */
export function notifyRecipients(){return (process.env.NEXORA_ONBOARDING_NOTIFY_EMAIL||'').split(',').map(s=>s.trim()).filter(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))}

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));

export type Block={p?:string;button?:{label:string;href:string};rows?:[string,string][];small?:string};
function layout(title:string,blocks:Block[]){
 const body=blocks.map(b=>{
  if(b.button)return `<p style="margin:26px 0"><a href="${esc(b.button.href)}" style="background:#d4000f;color:#ffffff;padding:13px 22px;border-radius:6px;display:inline-block;text-decoration:none;font-weight:700">${esc(b.button.label)}</a></p>`;
  if(b.rows)return `<table role="presentation" style="border-collapse:collapse;margin:14px 0;width:100%">${b.rows.map(([k,v])=>`<tr><td style="padding:6px 12px 6px 0;color:#5b5e66;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#000">${esc(v)}</td></tr>`).join('')}</table>`;
  if(b.small)return `<p style="color:#5b5e66;font-size:13px;line-height:1.5">${esc(b.small)}</p>`;
  return `<p style="line-height:1.55;color:#1f2024">${esc(b.p||'')}</p>`;
 }).join('');
 return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:auto;padding:28px 24px;border-top:5px solid #d4000f"><p style="font-weight:800;font-size:20px;margin:0 0 18px;color:#000">Nexora</p><h1 style="font-size:22px;margin:0 0 14px;color:#000">${esc(title)}</h1>${body}<hr style="border:0;border-top:1px solid #e3e4e8;margin:28px 0 12px"/><p style="color:#8a8d95;font-size:12px">Nexora HR Management System — People, Performance, Growth</p></div>`;
}
function text(title:string,blocks:Block[]){return [title,'',...blocks.map(b=>b.button?`${b.button.label}: ${b.button.href}`:b.rows?b.rows.map(([k,v])=>`${k}: ${v}`).join('\n'):(b.p||b.small||''))].join('\n\n')}

export async function sendEmail(to:string|string[],subject:string,title:string,blocks:Block[],replyTo?:string){
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)throw Error('Email delivery is not configured');
 const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({from,to,subject,html:layout(title,blocks),text:text(title,blocks),...(replyTo?{reply_to:replyTo}:{})})});
 if(!res.ok)throw Error(`Email provider returned ${res.status}`);
}
/** Fire-and-log variant for messages whose failure must not undo the action (acknowledgements, internal alerts). */
export async function trySendEmail(...args:Parameters<typeof sendEmail>){try{await sendEmail(...args);return true}catch(e){console.error('Onboarding email not delivered:',args[1],e instanceof Error?e.message:e);return false}}

// ─── Templates ───
type Tpl={subject:string;title:string;blocks:Block[]};
export const templates:Record<string,(...a:any[])=>Tpl>&{
 verify:(name:string,company:string,reference:string,link:string)=>Tpl;duplicateNotice:(link:string)=>Tpl;underReview:(name:string,company:string,reference:string)=>Tpl;
 invitation:(name:string,company:string,code:string,plan:string,link:string)=>Tpl;rejected:(name:string,company:string,reference:string,reason:string)=>Tpl;
 activated:(name:string,company:string,link:string)=>Tpl;leadAck:(name:string,kind:'DEMO'|'CONTACT')=>Tpl;internal:(subject:string,rows:[string,string][],link?:string)=>Tpl}={
 verify:(name:string,company:string,reference:string,link:string)=>({subject:'Confirm your Nexora registration',title:'Confirm your email address',blocks:[
  {p:`Hello ${name},`},{p:`Thanks for registering ${company} on Nexora. Confirm this email address so our team can review your registration.`},
  {button:{label:'Confirm email address',href:link}},{rows:[['Reference',reference]]},
  {small:'This link expires in 48 hours. If you did not register, ignore this email and nothing will be created.'}]}),
 duplicateNotice:(link:string)=>({subject:'About your Nexora registration',title:'This email is already in use',blocks:[
  {p:'Someone just tried to register a company on Nexora with this email address. The address already belongs to a Nexora account or to a registration that is in progress, so no new registration was created.'},
  {p:'If this was you, sign in with your existing account or reset your password. If you need a second company workspace, contact the Nexora team.'},
  {button:{label:'Sign in to Nexora',href:link}},{small:'If this was not you, no action is needed.'}]}),
 underReview:(name:string,company:string,reference:string)=>({subject:`Registration received — ${reference}`,title:'Your registration is under review',blocks:[
  {p:`Hello ${name},`},{p:`Your email is confirmed and ${company}'s registration is now with the Nexora team. We check every new company before creating its workspace. You'll receive an email as soon as a decision is made.`},
  {rows:[['Reference',reference]]}]}),
 invitation:(name:string,company:string,code:string,plan:string,link:string)=>({subject:`Your ${company} workspace on Nexora is ready`,title:'Set up your administrator account',blocks:[
  {p:`Hello ${name},`},{p:`${company} has been approved and its Nexora workspace has been created. You are its first administrator. Set your password to activate the workspace.`},
  {button:{label:'Activate workspace',href:link}},{rows:[['Company',company],['Company code',code],['Plan',plan]]},
  {small:'This invitation can be used once and expires in 72 hours. If it expires, ask the Nexora team to resend it.'}]}),
 rejected:(name:string,company:string,reference:string,reason:string)=>({subject:`Update on your Nexora registration — ${reference}`,title:'We could not approve this registration',blocks:[
  {p:`Hello ${name},`},{p:`We reviewed the registration for ${company} and could not approve it.`},{rows:[['Reason',reason],['Reference',reference]]},
  {p:'If you think this is a mistake or can provide more information, reply to this email or contact the Nexora team through the website.'}]}),
 activated:(name:string,company:string,link:string)=>({subject:`${company} is live on Nexora`,title:'Your workspace is active',blocks:[
  {p:`Hello ${name},`},{p:`${company}'s workspace is now active. Sign in to add branches and departments, invite your HR team and import employees.`},
  {button:{label:'Sign in',href:link}}]}),
 leadAck:(name:string,kind:'DEMO'|'CONTACT')=>({subject:kind==='DEMO'?'We received your demo request':'We received your message',title:kind==='DEMO'?'Demo request received':'Message received',blocks:[
  {p:`Hello ${name},`},{p:kind==='DEMO'?'Thanks for your interest in Nexora. A member of our team will contact you to arrange a walkthrough at a time that suits you.':'Thanks for contacting Nexora. A member of our team will reply to you by email.'}]}),
 internal:(subject:string,rows:[string,string][],link?:string)=>({subject,title:subject,blocks:[{rows},...(link?[{button:{label:'Open in Nexora Platform',href:link}}]:[])] as Block[]}),
};
