import {createHash, randomBytes} from 'node:crypto';
export const digestResetToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const newResetToken=()=>randomBytes(32).toString('hex');
export const RESET_WINDOW_MS=30*60*1000;
export function appOrigin(){
 const origin=process.env.NEXORA_APP_URL;
 if(!origin)throw Error('NEXORA_APP_URL is not configured');
 const url=new URL(origin);
 if(url.protocol!=='https:' && !(process.env.NODE_ENV!=='production' && url.hostname==='localhost'))throw Error('NEXORA_APP_URL must be HTTPS');
 return url.origin;
}
export async function sendPasswordResetEmail(to:string,link:string){
 const key=process.env.RESEND_API_KEY;
 const from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)throw Error('Resend email settings are missing');
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({from,to,subject:'Reset your Nexora password',text:`A password reset was requested for your Nexora account.\n\nUse this link within 30 minutes:\n${link}\n\nIf you did not request this, you can ignore this email.`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Nexora password reset</h2><p>A password reset was requested for your account.</p><p><a href="${link}" style="background:#cc0813;color:white;padding:12px 20px;border-radius:8px;display:inline-block;text-decoration:none">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p></div>`})
 });
 if(!response.ok)throw Error(`Resend delivery failed (${response.status})`);
}
