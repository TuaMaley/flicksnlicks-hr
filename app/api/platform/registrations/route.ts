import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {VERIFY_WINDOW_MS} from '../../../../lib/onboarding/constants';
import {checkDuplicates,loadPlan,parseRegistration,registrationColumns} from '../../../../lib/onboarding/registration';
import {OnboardingError,approveRegistration,cancelApproval,defaultCompanyCode,resendInvitation} from '../../../../lib/onboarding/provision';
import {clean,cleanMultiline,digestToken,newReference,newToken} from '../../../../lib/onboarding/security';
import {emailConfigured,siteOrigin,templates,trySendEmail} from '../../../../lib/onboarding/email';
export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store'};
const err=(error:string,status=400,extra:Record<string,unknown>={})=>NextResponse.json({error,...extra},{status,headers:noStore});
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{id:true,active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?a:null}
const STATUSES=['PENDING_VERIFICATION','PENDING_REVIEW','APPROVED','ACTIVE','REJECTED','CANCELLED'];

export async function GET(req:NextRequest){
 const actor=await guard();if(!actor)return err('Platform administrator required',403);
 const id=req.nextUrl.searchParams.get('id');
 if(id){
  const reg=await db.companyRegistration.findUnique({where:{id},select:{id:true,reference:true,source:true,status:true,companyName:true,companyType:true,registrationNumber:true,taxIdentifier:true,businessAddress:true,digitalAddress:true,country:true,city:true,industry:true,employeeBand:true,companyEmail:true,companyPhone:true,website:true,contactName:true,contactPosition:true,contactPhone:true,contactEmail:true,adminName:true,adminEmail:true,adminPhone:true,adminJobTitle:true,planId:true,planName:true,billingCycle:true,notes:true,termsAcceptedAt:true,emailTokenExpiresAt:true,emailVerifiedAt:true,reviewedById:true,reviewedAt:true,reviewNotes:true,rejectionReason:true,companyId:true,companyCode:true,adminUserId:true,approvedAt:true,activatedAt:true,createdById:true,createdAt:true,updatedAt:true}});
  if(!reg)return err('Registration not found',404);
  const [trail,invitations,dup,plans]=await Promise.all([
   db.auditLog.findMany({where:{OR:[{entity:'CompanyRegistration',entityId:reg.id},...(reg.companyId?[{entity:'Company',entityId:reg.companyId,action:{in:['COMPANY_WORKSPACE_PROVISIONED','COMPANY_ACTIVATED']}}]:[])]},orderBy:{createdAt:'asc'},take:200,select:{id:true,action:true,actorId:true,detail:true,createdAt:true}}),
   db.companyInvitation.findMany({where:{registrationId:reg.id},orderBy:{createdAt:'desc'},select:{id:true,email:true,createdAt:true,sentAt:true,expiresAt:true,acceptedAt:true,revokedAt:true}}),
   ['PENDING_VERIFICATION','PENDING_REVIEW','APPROVED'].includes(reg.status)?checkDuplicates(db,reg,reg.id):Promise.resolve(null),
   db.subscriptionPlan.findMany({where:{active:true},orderBy:{name:'asc'},select:{id:true,name:true,currency:true,monthlyPrice:true,annualPrice:true,moduleKeys:true}}),
  ]);
  const actorIds=[...new Set(trail.map(t=>t.actorId).filter((x):x is string=>Boolean(x)))];
  const actors=actorIds.length?await db.user.findMany({where:{id:{in:actorIds}},select:{id:true,name:true,email:true}}):[];
  const names=new Map(actors.map(a=>[a.id,`${a.name} (${a.email})`]));
  return NextResponse.json({registration:reg,duplicates:dup,suggestedCode:reg.companyCode||(reg.status==='PENDING_REVIEW'?await defaultCompanyCode():null),
   invitations,plans:plans.map(p=>({...p,monthlyPrice:Number(p.monthlyPrice),annualPrice:Number(p.annualPrice)})),
   trail:trail.map(t=>({...t,actor:t.actorId?names.get(t.actorId)||t.actorId:'Public website'})),emailConfigured:emailConfigured()},{headers:noStore});
 }
 const status=req.nextUrl.searchParams.get('status')||'';
 const q=clean(req.nextUrl.searchParams.get('q'),80);
 const where:any={};
 if(STATUSES.includes(status))where.status=status;
 if(q)where.OR=[{companyName:{contains:q,mode:'insensitive'}},{adminEmail:{contains:q,mode:'insensitive'}},{registrationNumber:{contains:q.toUpperCase()}},{reference:{contains:q.toUpperCase()}},{companyCode:{contains:q.toUpperCase()}}];
 const [rows,grouped,plans]=await Promise.all([
  db.companyRegistration.findMany({where,orderBy:{createdAt:'desc'},take:200,select:{id:true,reference:true,source:true,status:true,companyName:true,country:true,employeeBand:true,adminName:true,adminEmail:true,planName:true,billingCycle:true,duplicateFlags:true,emailTokenExpiresAt:true,companyCode:true,createdAt:true}}),
  db.companyRegistration.groupBy({by:['status'],_count:{_all:true}}),
  db.subscriptionPlan.findMany({where:{active:true},orderBy:{name:'asc'},select:{id:true,name:true,currency:true}}),
 ]);
 const counts=Object.fromEntries(STATUSES.map(s=>[s,grouped.find(g=>g.status===s)?._count._all||0]));
 const now=Date.now();
 return NextResponse.json({counts,plans,emailConfigured:emailConfigured(),registrations:rows.map(r=>({...r,duplicateCount:Array.isArray(r.duplicateFlags)?r.duplicateFlags.length:0,duplicateFlags:undefined,verificationExpired:r.status==='PENDING_VERIFICATION'&&(!r.emailTokenExpiresAt||r.emailTokenExpiresAt.getTime()<now)}))},{headers:noStore});
}

export async function POST(req:NextRequest){
 const actor=await guard();if(!actor)return err('Platform administrator required',403);
 const b=await req.json().catch(()=>null);
 const action=typeof b?.action==='string'?b.action:'';
 const id=typeof b?.id==='string'?b.id:'';
 const reason=cleanMultiline(b?.reason,500);
 try{
  switch(action){
   case 'createAssisted':{
    // Hybrid onboarding: a platform administrator enters the company on its behalf (sales-led / assisted).
    const {data,errors}=parseRegistration({...b,source:'platform'});
    if(!data)return err('Please fix the highlighted fields.',400,{fields:errors});
    const plan=await loadPlan(db,data.planId);if(!plan)return err('Please fix the highlighted fields.',400,{fields:{planId:'Choose an active plan with at least one module.'}});
    const dup=await checkDuplicates(db,data);
    if(dup.blockedReason)return err(dup.blockedReason==='ADMIN_EMAIL_HAS_ACCOUNT'?'This administrator email already has a Nexora account. Use a different email.':'An open registration already uses this administrator email.',409,{fields:{adminEmail:'Already in use'}});
    if(dup.businessConflict)return err(dup.businessConflict,409,{fields:{registrationNumber:'Already registered on Nexora'}});
    const reg=await db.$transaction(async tx=>{
     const r=await tx.companyRegistration.create({data:{...registrationColumns(data,plan.name),reference:newReference(),source:'PLATFORM_ADMIN',status:'PENDING_REVIEW',duplicateFlags:dup.flags as any,createdById:actor.id}});
     await tx.auditLog.create({data:{actorId:actor.id,action:'REGISTRATION_CREATED_BY_PLATFORM',entity:'CompanyRegistration',entityId:r.id,detail:{reference:r.reference,companyName:r.companyName,adminEmail:r.adminEmail,planName:plan.name,billingCycle:data.billingCycle,duplicateFlags:dup.flags.length}}});
     return r;
    });
    if(b?.approveNow===true){
     const code=clean(b?.companyCode,30)||await defaultCompanyCode();
     const out=await approveRegistration(actor.id,reg.id,{companyCode:code,reviewNotes:cleanMultiline(b?.reviewNotes,500)||'Assisted onboarding',acknowledgeDuplicates:b?.acknowledgeDuplicates===true});
     return NextResponse.json({id:reg.id,reference:reg.reference,approved:true,...out,message:out.invitationDelivered?`Workspace ${out.companyCode} created. Invitation sent to ${reg.adminEmail}.`:`Workspace ${out.companyCode} created, but the invitation email failed. Use “Resend invitation”.`},{status:201,headers:noStore});
    }
    return NextResponse.json({id:reg.id,reference:reg.reference,approved:false,message:`Registration ${reg.reference} added to the review queue.`},{status:201,headers:noStore});
   }
   case 'approve':{
    const out=await approveRegistration(actor.id,id,{companyCode:clean(b?.companyCode,30),planId:clean(b?.planId,40)||undefined,billingCycle:clean(b?.billingCycle,10)||undefined,reviewNotes:cleanMultiline(b?.reviewNotes,500)||null,acknowledgeDuplicates:b?.acknowledgeDuplicates===true});
    return NextResponse.json({...out,message:out.invitationDelivered?`Approved. Workspace ${out.companyCode} created and invitation sent.`:`Approved and workspace ${out.companyCode} created, but the invitation email failed. Use “Resend invitation”.`},{headers:noStore});
   }
   case 'reject':{
    if(reason.length<8)return err('Give the applicant a reason (at least 8 characters).');
    const reg=await db.companyRegistration.findUnique({where:{id}});if(!reg)return err('Registration not found',404);
    if(!['PENDING_REVIEW','PENDING_VERIFICATION'].includes(reg.status))return err('Only registrations awaiting review can be rejected. Use “Cancel” for approved registrations.',409);
    const claim=await db.companyRegistration.updateMany({where:{id,status:reg.status},data:{status:'REJECTED',rejectionReason:reason,reviewedById:actor.id,reviewedAt:new Date(),emailTokenHash:null}});
    if(claim.count!==1)return err('This registration was changed by someone else. Reload and try again.',409);
    let notified=false;
    if(b?.notifyApplicant!==false){const t=templates.rejected(reg.adminName,reg.companyName,reg.reference,reason);notified=await trySendEmail(reg.adminEmail,t.subject,t.title,t.blocks)}
    await db.auditLog.create({data:{actorId:actor.id,action:'REGISTRATION_REJECTED',entity:'CompanyRegistration',entityId:id,detail:{reference:reg.reference,reason,applicantNotified:notified}}});
    return NextResponse.json({message:notified?'Registration rejected and the applicant was emailed.':'Registration rejected. The applicant was not emailed.'},{headers:noStore});
   }
   case 'markVerified':{
    if(reason.length<8)return err('Explain how the email was confirmed (at least 8 characters).');
    const claim=await db.companyRegistration.updateMany({where:{id,status:'PENDING_VERIFICATION'},data:{status:'PENDING_REVIEW',emailVerifiedAt:new Date(),emailTokenHash:null}});
    if(claim.count!==1)return err('Only unconfirmed registrations can be marked verified.',409);
    await db.auditLog.create({data:{actorId:actor.id,action:'REGISTRATION_EMAIL_VERIFIED_MANUALLY',entity:'CompanyRegistration',entityId:id,detail:{reason}}});
    return NextResponse.json({message:'Marked as verified and moved to review.'},{headers:noStore});
   }
   case 'resendVerification':{
    const reg=await db.companyRegistration.findUnique({where:{id}});if(!reg||reg.status!=='PENDING_VERIFICATION')return err('Only unconfirmed registrations can be resent a confirmation link.',409);
    if(!emailConfigured())return err('Email delivery is not configured.',503);
    const token=newToken();
    await db.companyRegistration.update({where:{id},data:{emailTokenHash:digestToken(token),emailTokenExpiresAt:new Date(Date.now()+VERIFY_WINDOW_MS)}});
    const t=templates.verify(reg.adminName,reg.companyName,reg.reference,`${siteOrigin()}/register/verify?token=${token}`);
    const sent=await trySendEmail(reg.adminEmail,t.subject,t.title,t.blocks);
    await db.auditLog.create({data:{actorId:actor.id,action:sent?'REGISTRATION_VERIFICATION_RESENT':'REGISTRATION_VERIFICATION_DELIVERY_FAILED',entity:'CompanyRegistration',entityId:id,detail:{email:reg.adminEmail}}});
    return sent?NextResponse.json({message:'A new confirmation link was sent.'},{headers:noStore}):err('The confirmation email could not be delivered.',502);
   }
   case 'resendInvitation':{
    const sent=await resendInvitation(actor.id,id);
    return sent?NextResponse.json({message:'A new invitation was sent. Earlier links no longer work.'},{headers:noStore}):err('The invitation email could not be delivered. Check the email settings and try again.',502);
   }
   case 'cancel':{
    if(reason.length<8)return err('Give a reason (at least 8 characters).');
    await cancelApproval(actor.id,id,reason);
    return NextResponse.json({message:'Registration cancelled. Any invitation link has been revoked.'},{headers:noStore});
   }
   case 'note':{
    const note=cleanMultiline(b?.note,1000);if(note.length<2)return err('Write a note first.');
    if(!(await db.companyRegistration.findUnique({where:{id},select:{id:true}})))return err('Registration not found',404);
    await db.auditLog.create({data:{actorId:actor.id,action:'REGISTRATION_NOTE_ADDED',entity:'CompanyRegistration',entityId:id,detail:{note}}});
    return NextResponse.json({message:'Note added to the onboarding trail.'},{headers:noStore});
   }
   default:return err('Unknown action');
  }
 }catch(e){
  if(e instanceof OnboardingError)return err(e.message,e.status);
  console.error('Registration action failed',action,e);
  return err('The action failed. No changes were saved.',500);
 }
}
