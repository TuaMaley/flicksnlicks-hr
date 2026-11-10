import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {CONTACT_TOPICS,EMPLOYEE_BANDS} from '../../../../lib/onboarding/constants';
import {clean,cleanMultiline,clientIpHash,looksAutomated,normEmail,normPhone} from '../../../../lib/onboarding/security';
import {notifyRecipients,siteOrigin,templates,trySendEmail} from '../../../../lib/onboarding/email';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** Demo requests (kind DEMO) and contact messages (kind CONTACT) from the public website. */
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null);
 if(!b||typeof b!=='object')return NextResponse.json({error:'Invalid request'},{status:400,headers:noStore});
 const kind=b.kind==='DEMO'?'DEMO':b.kind==='CONTACT'?'CONTACT':null;
 if(!kind)return NextResponse.json({error:'Invalid request'},{status:400,headers:noStore});
 const ok=NextResponse.json({message:kind==='DEMO'?'Thanks — we will contact you to schedule your demo.':'Thanks — we will reply by email.'},{status:202,headers:noStore});
 const ipHash=clientIpHash(req);
 if(looksAutomated(b))return ok;
 const f:Record<string,string>={};
 const name=clean(b.name,120);if(name.length<2)f.name='Enter your name.';
 const email=normEmail(b.email);if(!email)f.email='Enter a valid email address.';
 const phone=normPhone(b.phone);if(phone==='__invalid__')f.phone='Use digits, spaces and an optional leading +.';
 const companyName=clean(b.companyName,120);
 const jobTitle=clean(b.jobTitle,120);
 const country=clean(b.country,80);
 const employeeBand=clean(b.employeeBand,20);if(employeeBand&&!(EMPLOYEE_BANDS as readonly string[]).includes(employeeBand))f.employeeBand='Choose a company size from the list.';
 const topic=clean(b.topic,40);if(topic&&!(CONTACT_TOPICS as readonly string[]).includes(topic))f.topic='Choose a topic from the list.';
 const message=cleanMultiline(b.message,2000);
 const preferredTime=clean(b.preferredTime,120);
 if(kind==='DEMO'&&companyName.length<2)f.companyName='Enter your company name.';
 if(kind==='CONTACT'&&message.length<10)f.message='Tell us a little more (at least 10 characters).';
 if(Object.keys(f).length)return NextResponse.json({error:'Please fix the highlighted fields.',fields:f},{status:400,headers:noStore});
 const recent=await db.websiteLead.count({where:{ipHash,createdAt:{gte:new Date(Date.now()-60*60*1000)}}});
 if(recent>=5)return NextResponse.json({error:'Too many messages from this network. Try again in an hour.'},{status:429,headers:noStore});
 try{
  const lead=await db.websiteLead.create({data:{kind,name,email,phone:phone||null,companyName:companyName||null,jobTitle:jobTitle||null,country:country||null,employeeBand:employeeBand||null,topic:topic||null,message:message||null,preferredTime:preferredTime||null,ipHash}});
  await db.auditLog.create({data:{action:kind==='DEMO'?'WEBSITE_DEMO_REQUESTED':'WEBSITE_CONTACT_RECEIVED',entity:'WebsiteLead',entityId:lead.id,detail:{email,companyName:companyName||null}}}).catch(()=>{});
 }catch(e){console.error('Lead create failed',e);return NextResponse.json({error:'We could not send your message. Please try again.'},{status:500,headers:noStore})}
 const ack=templates.leadAck(name,kind);await trySendEmail(email,ack.subject,ack.title,ack.blocks);
 const to=notifyRecipients();
 if(to.length){let link:string|undefined;try{link=`${siteOrigin()}/platform?section=Website%20Leads`}catch{}
  const t=templates.internal(kind==='DEMO'?`Demo request — ${companyName}`:`Website message — ${topic||'General'}`,[['Name',name],['Email',email],['Phone',phone||'—'],['Company',companyName||'—'],['Role',jobTitle||'—'],['Country',country||'—'],['Size',employeeBand||'—'],...(preferredTime?[['Preferred time',preferredTime]] as [string,string][]:[]),['Message',message||'—']],link);
  await trySendEmail(to,t.subject,t.title,t.blocks,email);}
 return ok;
}
