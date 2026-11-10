import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {VERIFY_WINDOW_MS} from '../../../../lib/onboarding/constants';
import {checkDuplicates,loadPlan,parseRegistration,registrationColumns} from '../../../../lib/onboarding/registration';
import {clean,clientIpHash,digestToken,looksAutomated,newReference,newToken} from '../../../../lib/onboarding/security';
import {emailConfigured,siteOrigin,templates,trySendEmail} from '../../../../lib/onboarding/email';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
// Same response whether the registration was created or silently blocked as a duplicate:
// the public form must not reveal which emails already have Nexora accounts.
const accepted=(reference:string|null)=>NextResponse.json({message:'Check your inbox to confirm your email address. The link expires in 48 hours.',reference},{status:202,headers:noStore});

export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid request'},{status:400,headers:noStore});
 const ipHash=clientIpHash(req);
 if(looksAutomated(body)){await db.auditLog.create({data:{action:'REGISTRATION_BLOCKED_AUTOMATED',entity:'CompanyRegistration',detail:{ipHash}}}).catch(()=>{});return accepted(null)}
 if(body.acceptTerms!==true)return NextResponse.json({error:'Please fix the highlighted fields.',fields:{acceptTerms:'Accept the terms and privacy policy to continue.'}},{status:400,headers:noStore});
 const {data,errors}=parseRegistration(body);
 if(!data)return NextResponse.json({error:'Please fix the highlighted fields.',fields:errors},{status:400,headers:noStore});
 // DB-backed throttle (works across Railway instances): 3/hour and 10/day per network.
 const [hour,day]=await Promise.all([
  db.companyRegistration.count({where:{ipHash,createdAt:{gte:new Date(Date.now()-60*60*1000)}}}),
  db.companyRegistration.count({where:{ipHash,createdAt:{gte:new Date(Date.now()-24*60*60*1000)}}}),
 ]);
 if(hour>=3||day>=10)return NextResponse.json({error:'Too many registrations from this network. Try again later or contact the Nexora team.'},{status:429,headers:noStore});
 if(!emailConfigured())return NextResponse.json({error:'Online registration is temporarily unavailable. Please use the contact form and our team will set you up.'},{status:503,headers:noStore});
 let origin:string;try{origin=siteOrigin()}catch{return NextResponse.json({error:'Online registration is temporarily unavailable.'},{status:503,headers:noStore})}
 const plan=await loadPlan(db,data.planId);
 if(!plan)return NextResponse.json({error:'Please fix the highlighted fields.',fields:{planId:'That plan is no longer available. Choose another plan.'}},{status:400,headers:noStore});

 const dup=await checkDuplicates(db,data);
 if(dup.blockedReason){
  await db.auditLog.create({data:{action:'REGISTRATION_DUPLICATE_BLOCKED',entity:'CompanyRegistration',detail:{reason:dup.blockedReason,adminEmail:data.adminEmail,companyName:data.companyName,ipHash}}}).catch(()=>{});
  // Tell the real owner of the address, not the requester.
  const t=templates.duplicateNotice(`${origin}/login`);
  await trySendEmail(data.adminEmail,t.subject,t.title,t.blocks);
  return accepted(null);
 }
 const token=newToken();
 let reg;
 try{
  reg=await db.$transaction(async tx=>{
   const r=await tx.companyRegistration.create({data:{...registrationColumns(data,plan.name),reference:newReference(),source:'SELF_SERVICE',status:'PENDING_VERIFICATION',duplicateFlags:dup.flags as any,termsAcceptedAt:new Date(),emailTokenHash:digestToken(token),emailTokenExpiresAt:new Date(Date.now()+VERIFY_WINDOW_MS),ipHash,userAgent:clean(req.headers.get('user-agent'),300)||null}});
   await tx.auditLog.create({data:{action:'REGISTRATION_SUBMITTED',entity:'CompanyRegistration',entityId:r.id,detail:{reference:r.reference,source:'SELF_SERVICE',companyName:r.companyName,adminEmail:r.adminEmail,planName:plan.name,billingCycle:data.billingCycle,duplicateFlags:dup.flags.length,ipHash}}});
   return r;
  });
 }catch(e){console.error('Registration create failed',e);return NextResponse.json({error:'We could not save your registration. Please try again.'},{status:500,headers:noStore})}
 const t=templates.verify(data.adminName,data.companyName,reg.reference,`${origin}/register/verify?token=${token}`);
 const sent=await trySendEmail(data.adminEmail,t.subject,t.title,t.blocks);
 await db.auditLog.create({data:{action:sent?'REGISTRATION_VERIFICATION_SENT':'REGISTRATION_VERIFICATION_DELIVERY_FAILED',entity:'CompanyRegistration',entityId:reg.id,detail:{email:data.adminEmail}}}).catch(()=>{});
 if(!sent)return NextResponse.json({error:`We saved your registration (${reg.reference}) but could not send the confirmation email. Contact the Nexora team with this reference.`,reference:reg.reference},{status:502,headers:noStore});
 return accepted(reg.reference);
}
