// Phase 17 — approval, workspace creation, invitations and activation.
// Every state change writes an AuditLog row (entity "CompanyRegistration" or "Company") so the
// onboarding trail can be rebuilt for any company.
import {randomBytes,randomUUID} from 'node:crypto';
import {db} from '../db';
import {hashPassword} from '../auth';
import {INVITE_WINDOW_MS,MODULE_KEYS} from './constants';
import {checkDuplicates,loadPlan,termEnd} from './registration';
import {digestToken,newToken} from './security';
import {emailConfigured,sendEmail,siteOrigin,templates,trySendEmail} from './email';

export class OnboardingError extends Error{constructor(message:string,public status=400){super(message)}}

const CODE_RE=/^[A-Z0-9_-]{2,30}$/;

/** Default company code in the same format as Platform › Companies › Onboard Company (NX00012-1A2B3C). */
export async function defaultCompanyCode(){
 for(let i=0;i<10;i++){const c='NX'+(await db.company.count()+1+i).toString().padStart(5,'0')+'-'+randomUUID().slice(0,6).toUpperCase();if(!(await db.company.findUnique({where:{code:c},select:{id:true}})))return c}
 throw new OnboardingError('Could not generate a company code; enter one manually.',409);
}

/** Picks an unused company code, starting from the requested/suggested base. */
export async function availableCode(base:string){
 const clean=base.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24)||'COMPANY';
 if(!(await db.company.findUnique({where:{code:clean},select:{id:true}})))return clean;
 for(let i=0;i<20;i++){const c=`${clean}-${String(randomBytes(2).readUInt16BE()%1000).padStart(3,'0')}`;if(!(await db.company.findUnique({where:{code:c},select:{id:true}})))return c}
 throw new OnboardingError('Could not find a free company code; enter one manually.',409);
}

type ApproveOptions={companyCode:string;planId?:string;billingCycle?:string;reviewNotes?:string|null;acknowledgeDuplicates?:boolean};

/**
 * Approves a registration and creates the company workspace in ONE transaction:
 * inactive company, Head Office branch, company-scoped Administrator role, inactive administrator
 * login, membership, plan modules, PENDING subscription, billing profile and a single-use invitation.
 * The company only becomes active when the administrator accepts the invitation.
 */
export async function approveRegistration(actorId:string,registrationId:string,o:ApproveOptions){
 const reg=await db.companyRegistration.findUnique({where:{id:registrationId}});
 if(!reg)throw new OnboardingError('Registration not found',404);
 if(reg.status!=='PENDING_REVIEW')throw new OnboardingError(reg.status==='PENDING_VERIFICATION'?'The applicant has not confirmed their email yet. Mark it verified only if you have confirmed the address another way.':'Only registrations awaiting review can be approved.',409);
 const code=o.companyCode.trim().toUpperCase();
 if(!CODE_RE.test(code))throw new OnboardingError('Company code must be 2–30 characters: A–Z, 0–9, hyphen or underscore.');
 const billingCycle=o.billingCycle==='ANNUAL'?'ANNUAL':o.billingCycle==='MONTHLY'?'MONTHLY':reg.billingCycle;
 const plan=await loadPlan(db,o.planId||reg.planId||'');
 if(!plan)throw new OnboardingError('Select an active subscription plan with at least one module.');
 const dup=await checkDuplicates(db,{companyName:reg.companyName,companyEmail:reg.companyEmail,companyPhone:reg.companyPhone,adminEmail:reg.adminEmail,registrationNumber:reg.registrationNumber,taxIdentifier:reg.taxIdentifier},reg.id);
 if(dup.businessConflict)throw new OnboardingError(`${dup.businessConflict} Reject this registration or ask the applicant to contact their existing Nexora administrator.`,409);
 if(dup.blockedReason)throw new OnboardingError(dup.blockedReason==='ADMIN_EMAIL_HAS_ACCOUNT'?'The administrator email already belongs to a Nexora account. Ask the applicant for a different administrator email, or reject this registration.':'Another open registration already uses this administrator email.',409);
 if(dup.flags.some(f=>f.severity==='high')&&o.acknowledgeDuplicates!==true)throw new OnboardingError('This registration matches an existing company or registration. Review the duplicate warnings and confirm before approving.',409);
 if(!emailConfigured())throw new OnboardingError('Email delivery is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL), so the administrator invitation cannot be sent.',503);
 let origin:string;try{origin=siteOrigin()}catch{throw new OnboardingError('NEXORA_APP_URL must be configured before approving registrations.',503)}

 const token=newToken();
 const now=new Date();
 let result:{companyId:string;userId:string;invitationId:string};
 try{
  result=await db.$transaction(async tx=>{
   // Optimistic lock: only one reviewer can move the registration out of PENDING_REVIEW.
   const claim=await tx.companyRegistration.updateMany({where:{id:reg.id,status:'PENDING_REVIEW'},data:{status:'APPROVED'}});
   if(claim.count!==1)throw new OnboardingError('This registration was changed by someone else. Reload and try again.',409);
   const permissions=await tx.permission.findMany({select:{id:true}});
   if(!permissions.length)throw new OnboardingError('Permission catalog is empty; initialise platform permissions first.',500);
   const company=await tx.company.create({data:{name:reg.companyName,code,country:reg.country||'Ghana',email:reg.companyEmail,phone:reg.companyPhone,registrationNumber:reg.registrationNumber,companyType:reg.companyType,taxIdentifier:reg.taxIdentifier,businessAddress:reg.businessAddress,digitalAddress:reg.digitalAddress,industry:reg.industry,contactName:reg.contactName,contactPosition:reg.contactPosition,contactPhone:reg.contactPhone,contactEmail:reg.contactEmail,website:reg.website,active:false}});
   await tx.branch.create({data:{companyId:company.id,name:'Head Office'}});
   const role=await tx.role.create({data:{name:`Administrator [${company.id}]`,companyId:company.id,description:'Company HRMS Administrator',system:true,protected:true,active:true,permissions:{create:permissions.map(p=>({permissionId:p.id}))}}});
   // Unusable random password; the real one is set by the administrator through the invitation.
   const user=await tx.user.create({data:{name:reg.adminName,email:reg.adminEmail,passwordHash:hashPassword(randomBytes(48).toString('hex')),active:false,platformAdmin:false}});
   await tx.companyMembership.create({data:{companyId:company.id,userId:user.id,active:true,roles:{create:{roleId:role.id}}}});
   for(const key of MODULE_KEYS)await tx.companyModule.create({data:{companyId:company.id,moduleKey:key,enabled:plan.moduleKeys.includes(key)}});
   // Placeholder term; the real start/end are set when the workspace is activated.
   await tx.platformSubscription.create({data:{companyId:company.id,planName:plan.name,startsAt:now,endsAt:termEnd(now,billingCycle),status:'PENDING',notes:`Awaiting activation · ${billingCycle.toLowerCase()} billing · registration ${reg.reference}`}});
   await tx.nexoraBillingProfile.create({data:{companyId:company.id,billingName:reg.companyName,billingEmail:reg.companyEmail,currency:plan.currency}});
   const inv=await tx.companyInvitation.create({data:{companyId:company.id,userId:user.id,registrationId:reg.id,email:reg.adminEmail,tokenHash:digestToken(token),expiresAt:new Date(Date.now()+INVITE_WINDOW_MS),createdById:actorId}});
   await tx.companyRegistration.update({where:{id:reg.id},data:{companyId:company.id,companyCode:code,adminUserId:user.id,planId:plan.id,planName:plan.name,billingCycle,reviewedById:actorId,reviewedAt:now,approvedAt:now,reviewNotes:o.reviewNotes||null,duplicateFlags:dup.flags as any}});
   await tx.auditLog.create({data:{actorId,companyId:company.id,action:'REGISTRATION_APPROVED',entity:'CompanyRegistration',entityId:reg.id,detail:{reference:reg.reference,companyCode:code,planId:plan.id,planName:plan.name,billingCycle,duplicateFlags:dup.flags.length,acknowledgedDuplicates:o.acknowledgeDuplicates===true,notes:o.reviewNotes||null}}});
   await tx.auditLog.create({data:{actorId,companyId:company.id,action:'COMPANY_WORKSPACE_PROVISIONED',entity:'Company',entityId:company.id,detail:{registrationId:reg.id,reference:reg.reference,administratorId:user.id,modules:plan.moduleKeys,subscription:'PENDING'}}});
   return {companyId:company.id,userId:user.id,invitationId:inv.id};
  },{timeout:30000});
 }catch(e:any){
  if(e instanceof OnboardingError)throw e;
  if(e?.code==='P2002')throw new OnboardingError('Company code or administrator email is already in use. Choose another code or check for an existing account.',409);
  console.error('Registration approval failed',e);
  throw new OnboardingError('Approval failed. Nothing was created; the registration is still awaiting review.',500);
 }
 const delivered=await deliverInvitation(actorId,reg.id,result.invitationId,token,origin,{name:reg.adminName,email:reg.adminEmail,company:reg.companyName,code,plan:plan.name});
 return {...result,companyCode:code,invitationDelivered:delivered};
}

async function deliverInvitation(actorId:string,registrationId:string,invitationId:string,token:string,origin:string,p:{name:string;email:string;company:string;code:string;plan:string}){
 const t=templates.invitation(p.name,p.company,p.code,p.plan,`${origin}/accept-invitation?token=${token}`);
 const reg=await db.companyRegistration.findUnique({where:{id:registrationId},select:{companyId:true}});
 try{
  await sendEmail(p.email,t.subject,t.title,t.blocks);
  await db.companyInvitation.update({where:{id:invitationId},data:{sentAt:new Date()}});
  await db.auditLog.create({data:{actorId,companyId:reg?.companyId,action:'ONBOARDING_INVITATION_SENT',entity:'CompanyRegistration',entityId:registrationId,detail:{invitationId,email:p.email}}});
  return true;
 }catch(e){
  // Never leave a working link that nobody received: revoke it so a resend issues a fresh one.
  await db.companyInvitation.update({where:{id:invitationId},data:{revokedAt:new Date()}}).catch(()=>{});
  await db.auditLog.create({data:{actorId,companyId:reg?.companyId,action:'ONBOARDING_INVITATION_DELIVERY_FAILED',entity:'CompanyRegistration',entityId:registrationId,detail:{invitationId,email:p.email,error:e instanceof Error?e.message:'unknown'}}}).catch(()=>{});
  console.error('Onboarding invitation delivery failed',e);
  return false;
 }
}

/** Revokes any outstanding invitation and sends a fresh one (approved registrations only). */
export async function resendInvitation(actorId:string,registrationId:string){
 const reg=await db.companyRegistration.findUnique({where:{id:registrationId}});
 if(!reg)throw new OnboardingError('Registration not found',404);
 if(reg.status!=='APPROVED'||!reg.companyId||!reg.adminUserId)throw new OnboardingError('Invitations can only be resent for approved registrations that are not yet active.',409);
 if(!emailConfigured())throw new OnboardingError('Email delivery is not configured.',503);
 let origin:string;try{origin=siteOrigin()}catch{throw new OnboardingError('NEXORA_APP_URL must be configured.',503)}
 const token=newToken();
 const inv=await db.$transaction(async tx=>{
  await tx.companyInvitation.updateMany({where:{registrationId:reg.id,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
  return tx.companyInvitation.create({data:{companyId:reg.companyId!,userId:reg.adminUserId!,registrationId:reg.id,email:reg.adminEmail,tokenHash:digestToken(token),expiresAt:new Date(Date.now()+INVITE_WINDOW_MS),createdById:actorId}});
 });
 return deliverInvitation(actorId,reg.id,inv.id,token,origin,{name:reg.adminName,email:reg.adminEmail,company:reg.companyName,code:reg.companyCode||'',plan:reg.planName||''});
}

/** Looks up an invitation for display. Returns null for unknown, used, revoked or expired tokens. */
export async function previewInvitation(token:string){
 const inv=await db.companyInvitation.findUnique({where:{tokenHash:digestToken(token)},select:{companyId:true,userId:true,email:true,expiresAt:true,acceptedAt:true,revokedAt:true}});
 if(!inv||inv.acceptedAt||inv.revokedAt||inv.expiresAt<=new Date())return null;
 const [company,user]=await Promise.all([db.company.findUnique({where:{id:inv.companyId},select:{name:true,code:true}}),db.user.findUnique({where:{id:inv.userId},select:{name:true,active:true}})]);
 if(!company||!user||user.active)return null;
 return {companyName:company.name,companyCode:company.code,adminName:user.name,email:inv.email};
}

/**
 * Accepts an invitation: sets the administrator's password and activates the user, the company and its
 * subscription (term starts now). Single-use and race-safe.
 */
export async function acceptInvitation(token:string,password:string){
 const now=new Date();
 const out=await db.$transaction(async tx=>{
  const inv=await tx.companyInvitation.findUnique({where:{tokenHash:digestToken(token)}});
  if(!inv||inv.acceptedAt||inv.revokedAt||inv.expiresAt<=now)return null;
  const user=await tx.user.findUnique({where:{id:inv.userId},select:{id:true,active:true,platformAdmin:true,email:true,name:true}});
  if(!user||user.active||user.platformAdmin||user.email!==inv.email)return null;
  // Tenant binding: the invited user must hold an active membership in exactly the invited company.
  const membership=await tx.companyMembership.findUnique({where:{companyId_userId:{companyId:inv.companyId,userId:user.id}},select:{active:true}});
  if(!membership?.active)return null;
  const claim=await tx.companyInvitation.updateMany({where:{id:inv.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:now}},data:{acceptedAt:now}});
  if(claim.count!==1)return null;
  await tx.companyInvitation.updateMany({where:{userId:user.id,acceptedAt:null,revokedAt:null},data:{revokedAt:now}});
  await tx.user.update({where:{id:user.id},data:{passwordHash:hashPassword(password),active:true}});
  const company=await tx.company.update({where:{id:inv.companyId},data:{active:true},select:{id:true,name:true}});
  const reg=inv.registrationId?await tx.companyRegistration.findUnique({where:{id:inv.registrationId},select:{id:true,billingCycle:true,reference:true}}):null;
  const pending=await tx.platformSubscription.findFirst({where:{companyId:company.id,status:'PENDING'},orderBy:{createdAt:'desc'}});
  if(pending){
   const overlap=await tx.platformSubscription.findFirst({where:{companyId:company.id,status:'ACTIVE',endsAt:{gt:now}},select:{id:true}});
   if(!overlap)await tx.platformSubscription.update({where:{id:pending.id},data:{status:'ACTIVE',startsAt:now,endsAt:termEnd(now,reg?.billingCycle||'MONTHLY'),notes:`Activated by first administrator${reg?` · registration ${reg.reference}`:''}`}});
  }
  if(reg)await tx.companyRegistration.update({where:{id:reg.id},data:{status:'ACTIVE',activatedAt:now}});
  await tx.auditLog.create({data:{actorId:user.id,companyId:company.id,action:'ONBOARDING_INVITATION_ACCEPTED',entity:'CompanyRegistration',entityId:reg?.id||inv.id,detail:{invitationId:inv.id}}});
  await tx.auditLog.create({data:{actorId:user.id,companyId:company.id,action:'COMPANY_ACTIVATED',entity:'Company',entityId:company.id,detail:{registrationId:reg?.id||null,subscriptionActivated:Boolean(pending)}}});
  return {companyName:company.name,email:user.email,name:user.name};
 },{timeout:20000});
 if(out){try{const t=templates.activated(out.name,out.companyName,`${siteOrigin()}/login`);await trySendEmail(out.email,t.subject,t.title,t.blocks)}catch{}}
 return out;
}

/** Withdraws an approval that was never accepted: revokes invitations and cancels the pending subscription. The company stays inactive. */
export async function cancelApproval(actorId:string,registrationId:string,reason:string){
 return db.$transaction(async tx=>{
  const reg=await tx.companyRegistration.findUnique({where:{id:registrationId}});
  if(!reg)throw new OnboardingError('Registration not found',404);
  if(!['APPROVED','PENDING_REVIEW','PENDING_VERIFICATION'].includes(reg.status))throw new OnboardingError('Only registrations that are not yet active can be cancelled.',409);
  const now=new Date();
  await tx.companyRegistration.update({where:{id:reg.id},data:{status:'CANCELLED',reviewedById:actorId,reviewedAt:now,reviewNotes:reason,emailTokenHash:null}});
  if(reg.companyId){
   await tx.companyInvitation.updateMany({where:{registrationId:reg.id,acceptedAt:null,revokedAt:null},data:{revokedAt:now}});
   await tx.platformSubscription.updateMany({where:{companyId:reg.companyId,status:'PENDING'},data:{status:'CANCELLED'}});
   await tx.company.update({where:{id:reg.companyId},data:{active:false}});
  }
  await tx.auditLog.create({data:{actorId,companyId:reg.companyId,action:'REGISTRATION_CANCELLED',entity:'CompanyRegistration',entityId:reg.id,detail:{reference:reg.reference,previousStatus:reg.status,reason}}});
  return true;
 });
}
