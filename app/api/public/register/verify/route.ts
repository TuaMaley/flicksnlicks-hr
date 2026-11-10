import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/db';
import {digestToken,isToken} from '../../../../../lib/onboarding/security';
import {notifyRecipients,siteOrigin,templates,trySendEmail} from '../../../../../lib/onboarding/email';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** Confirms the applicant's email and moves the registration into the platform review queue. */
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 if(!isToken(body?.token))return NextResponse.json({error:'This confirmation link is not valid.'},{status:400,headers:noStore});
 const now=new Date();
 const reg=await db.companyRegistration.findUnique({where:{emailTokenHash:digestToken(body.token)}});
 if(!reg)return NextResponse.json({error:'This confirmation link is not valid or has already been used.'},{status:400,headers:noStore});
 if(reg.status!=='PENDING_VERIFICATION')return NextResponse.json({message:'Your email is already confirmed.',reference:reg.reference,companyName:reg.companyName},{headers:noStore});
 if(!reg.emailTokenExpiresAt||reg.emailTokenExpiresAt<=now)return NextResponse.json({error:'This confirmation link has expired. Register again to receive a new link.'},{status:410,headers:noStore});
 const claim=await db.companyRegistration.updateMany({where:{id:reg.id,status:'PENDING_VERIFICATION',emailTokenHash:reg.emailTokenHash},data:{status:'PENDING_REVIEW',emailVerifiedAt:now,emailTokenHash:null}});
 if(claim.count!==1)return NextResponse.json({message:'Your email is already confirmed.',reference:reg.reference,companyName:reg.companyName},{headers:noStore});
 await db.auditLog.create({data:{action:'REGISTRATION_EMAIL_VERIFIED',entity:'CompanyRegistration',entityId:reg.id,detail:{reference:reg.reference,email:reg.adminEmail}}}).catch(()=>{});
 const ack=templates.underReview(reg.adminName,reg.companyName,reg.reference);
 await trySendEmail(reg.adminEmail,ack.subject,ack.title,ack.blocks);
 const to=notifyRecipients();
 if(to.length){let link:string|undefined;try{link=`${siteOrigin()}/platform?section=Registrations`}catch{}
  const t=templates.internal(`New company registration — ${reg.companyName}`,[['Reference',reg.reference],['Company',`${reg.companyName}${reg.companyType?` (${reg.companyType})`:''}`],['Registration no.',reg.registrationNumber||'—'],['Industry',reg.industry||'—'],['Size',reg.employeeBand||'—'],['Plan',`${reg.planName||'—'} (${reg.billingCycle.toLowerCase()})`],['Administrator',`${reg.adminName} <${reg.adminEmail}>`],['Duplicate warnings',String(Array.isArray(reg.duplicateFlags)?reg.duplicateFlags.length:0)]],link);
  await trySendEmail(to,t.subject,t.title,t.blocks);}
 return NextResponse.json({message:'Email confirmed. Your registration is now under review.',reference:reg.reference,companyName:reg.companyName},{headers:noStore});
}
