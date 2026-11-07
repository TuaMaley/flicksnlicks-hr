import {NextRequest, NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {currentUser, hashPassword} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {appOrigin, digestResetToken, newResetToken} from '../../../../lib/passwordReset';

export const runtime='nodejs';
const noCache={'Cache-Control':'private, no-store'};
async function guard(){
 const session=await currentUser();
 if(!session)return null;
 const user=await db.user.findUnique({where:{id:session.id},select:{id:true,active:true,platformAdmin:true}});
 return user?.active&&user.platformAdmin?user:null;
}
function response(error:string,status:number){return NextResponse.json({error},{status,headers:noCache})}
export async function GET(){
 const actor=await guard();if(!actor)return response('Platform administrator access required',403);
 const admins=await db.user.findMany({where:{platformAdmin:true},select:{id:true,name:true,email:true,active:true,createdAt:true,updatedAt:true,passwordResets:{where:{usedAt:null},select:{expiresAt:true},orderBy:{createdAt:'desc'},take:1}},orderBy:{createdAt:'asc'}});
 return NextResponse.json({admins:admins.map(({passwordResets,...admin})=>({...admin,invitationStatus:admin.active?'Active':passwordResets.length?(passwordResets[0].expiresAt>new Date()?'Pending':'Expired'):'Not sent'})),currentUserId:actor.id},{headers:noCache});
}
export async function POST(req:NextRequest){
 const actor=await guard();if(!actor)return response('Platform administrator access required',403);
 const body=await req.json().catch(()=>null);
 if(!body||typeof body.action!=='string')return response('Invalid request',400);
 if(body.action==='invite'){
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(name.length<2||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return response('Enter a valid name and email',400);
  const existing=await db.user.findUnique({where:{email},select:{id:true,active:true,platformAdmin:true,employeeId:true,companyMemberships:{select:{id:true},take:1}}});
  if(existing){
   // Reuse only an explicitly soft-deleted platform administrator. Never take over a
   // regular user or a company-linked account merely because its email matches.
   const deleted=await db.auditLog.findFirst({where:{entity:'User',entityId:existing.id,action:'PLATFORM_ADMIN_SOFT_DELETED'},select:{id:true}});
   if(!deleted||existing.active||existing.platformAdmin||existing.employeeId||existing.companyMemberships.length)
    return response('This email belongs to an existing account and cannot be reused for a platform invitation.',409);
  }
  // Do not grant platform access unless the invitation email can be sent.
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return response('Email delivery is not configured',503);
  let origin:string;
  try{origin=appOrigin()}catch{return response('NEXORA_APP_URL must be configured',503)}
  const token=newResetToken();
  const link=`${origin}/platform-invite?token=${token}`;
  const randomPassword=randomBytes(48).toString('hex');
  let userId:string;
  try{
   const user=await db.$transaction(async tx=>{
    let created;
    if(existing){
     const current=await tx.user.findUnique({where:{id:existing.id},select:{active:true,platformAdmin:true,employeeId:true}});
     if(!current||current.active||current.platformAdmin||current.employeeId||await tx.companyMembership.count({where:{userId:existing.id}}))throw Error('ACCOUNT_NOT_ELIGIBLE');
     // Invalidate old links and revoke old tenant privileges before issuing a new invite.
     await tx.passwordResetToken.updateMany({where:{userId:existing.id,usedAt:null},data:{usedAt:new Date()}});
     await tx.userRole.deleteMany({where:{userId:existing.id}});
     await tx.userAccessScope.deleteMany({where:{userId:existing.id}});
     created=await tx.user.update({where:{id:existing.id},data:{name,platformAdmin:true,active:false,passwordHash:hashPassword(randomPassword)}});
     await tx.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_REINVITED_AFTER_DELETION',entity:'User',entityId:created.id,detail:{email}}});
    }else{
     created=await tx.user.create({data:{name,email,platformAdmin:true,active:false,passwordHash:hashPassword(randomPassword)}});
    }
    await tx.passwordResetToken.create({data:{userId:created.id,tokenHash:digestResetToken(token),expiresAt:new Date(Date.now()+24*60*60*1000)}});
    await tx.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_INVITED',entity:'User',entityId:created.id,detail:{email}}});
    return created;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   userId=user.id;
  }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return response('Email already exists',409);if(e instanceof Error&&e.message==='ACCOUNT_NOT_ELIGIBLE')return response('This account cannot be reused',409);console.error('Platform invitation creation failed',e);return response('Unable to create invitation',500)}
  try{
   const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:email,subject:'Your Nexora Platform Administrator invitation',text:`You have been invited to become a Nexora Platform Administrator. Set your password using this link within 24 hours: ${link}\n\nIf you did not expect this invitation, contact your platform administrator.`,html:`<p>You have been invited to become a Nexora Platform Administrator.</p><p><a href="${link}">Set your password</a> (expires in 24 hours).</p><p>If unexpected, contact your platform administrator.</p>`})});
   if(!sent.ok)throw Error(`Email provider returned ${sent.status}`);
  }catch(e){
   // Keep account inactive and invalidate the token; never expose a working invite URL in a response/log.
   await db.passwordResetToken.deleteMany({where:{userId}}).catch(()=>{});
   await db.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_INVITE_DELIVERY_FAILED',entity:'User',entityId:userId,detail:{email}}}).catch(()=>{});
   console.error('Platform invitation delivery failed',e);
   return response('Invitation email could not be delivered. The account remains inactive. Contact an administrator to retry safely.',502);
  }
  return NextResponse.json({message:'Invitation sent. The account remains inactive until the recipient sets a password.'},{status:201,headers:noCache});
 }
 if(body.action==='resendInvite'){
  const id=typeof body.id==='string'?body.id:'';
  if(!id)return response('Administrator ID required',400);
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return response('Email delivery is not configured',503);
  let origin:string;
  try{origin=appOrigin()}catch{return response('NEXORA_APP_URL must be configured',503)}
  const token=newResetToken();
  let target:{id:string;email:string};
  try{
   target=await db.$transaction(async tx=>{
    const user=await tx.user.findUnique({where:{id},select:{id:true,email:true,active:true,platformAdmin:true}});
    if(!user?.platformAdmin)throw Error('NOT_FOUND');
    if(user.active)throw Error('ALREADY_ACTIVE');
    await tx.passwordResetToken.updateMany({where:{userId:id,usedAt:null},data:{usedAt:new Date()}});
    await tx.passwordResetToken.create({data:{userId:id,tokenHash:digestResetToken(token),expiresAt:new Date(Date.now()+24*60*60*1000)}});
    await tx.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_INVITATION_REISSUED',entity:'User',entityId:id,detail:{email:user.email}}});
    return {id:user.id,email:user.email};
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(e){const code=e instanceof Error?e.message:'';if(code==='NOT_FOUND')return response('Administrator not found',404);if(code==='ALREADY_ACTIVE')return response('Active administrators do not need invitations',409);console.error('Invitation renewal failed',e);return response('Unable to renew invitation',500)}
  const link=`${origin}/platform-invite?token=${token}`;
  try{
   const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:target.email,subject:'Your Nexora Platform Administrator invitation',text:`You have been invited to become a Nexora Platform Administrator. Set your password within 24 hours: ${link}\n\nIf you did not expect this invitation, contact your platform administrator.`,html:`<p>You have been invited to become a Nexora Platform Administrator.</p><p><a href="${link}">Set your password</a> (expires in 24 hours).</p><p>If unexpected, contact your platform administrator.</p>`})});
   if(!sent.ok)throw Error(`Email provider returned ${sent.status}`);
  }catch(e){
   await db.passwordResetToken.updateMany({where:{userId:id,tokenHash:digestResetToken(token),usedAt:null},data:{usedAt:new Date()}}).catch(()=>{});
   await db.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_RESEND_DELIVERY_FAILED',entity:'User',entityId:id}}).catch(()=>{});
   console.error('Invitation resend delivery failed',e);
   return response('Invitation email could not be delivered. Please retry after checking email configuration.',502);
  }
  return NextResponse.json({message:'A fresh invitation was emailed. Previous invitation links are no longer valid.'},{headers:noCache});
 }
 if(body.action==='softDelete'){
  const id=typeof body.id==='string'?body.id:'';
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!id||reason.length<10||reason.length>500)return response('Administrator and deletion reason (10–500 characters) required',400);
  if(id===actor.id)return response('You cannot delete your own account',400);
  try{
   await db.$transaction(async tx=>{
    const target=await tx.user.findUnique({where:{id},select:{id:true,active:true,platformAdmin:true,email:true}});
    if(!target?.platformAdmin)throw Error('NOT_FOUND');
    if(target.active){const count=await tx.user.count({where:{platformAdmin:true,active:true}});if(count<=1)throw Error('LAST_ADMIN')}
    // Soft deletion retains the User row and audit trail but removes platform privileges.
    await tx.user.update({where:{id},data:{active:false,platformAdmin:false}});
    await tx.passwordResetToken.updateMany({where:{userId:id,usedAt:null},data:{usedAt:new Date()}});
    await tx.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_SOFT_DELETED',entity:'User',entityId:id,detail:{reason,email:target.email}}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return NextResponse.json({message:'Administrator access removed and account deactivated. Audit history retained.'},{headers:noCache});
  }catch(e){const code=e instanceof Error?e.message:'';if(code==='NOT_FOUND')return response('Administrator not found',404);if(code==='LAST_ADMIN')return response('Cannot delete the last active platform administrator',409);console.error('Platform admin removal failed',e);return response('Unable to delete administrator',500)}
 }
 if(body.action==='setStatus'){
  const id=typeof body.id==='string'?body.id:'';
  const active=body.active;
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!id||typeof active!=='boolean'||reason.length<10||reason.length>500)return response('User, status, and reason (10–500 characters) required',400);
  if(id===actor.id&&!active)return response('You cannot deactivate your own account',400);
  try{
   await db.$transaction(async tx=>{
    const target=await tx.user.findUnique({where:{id},select:{id:true,platformAdmin:true,active:true}});
    if(!target?.platformAdmin)throw Error('NOT_FOUND');
    if(target.active===active)throw Error('UNCHANGED');
    if(active){const pending=await tx.passwordResetToken.count({where:{userId:id,usedAt:null}});if(pending)throw Error('PENDING_INVITE')}
    if(!active){const count=await tx.user.count({where:{platformAdmin:true,active:true}});if(count<=1)throw Error('LAST_ADMIN')}
    await tx.user.update({where:{id},data:{active}});
    await tx.auditLog.create({data:{actorId:actor.id,action:active?'PLATFORM_ADMIN_ACTIVATED':'PLATFORM_ADMIN_DEACTIVATED',entity:'User',entityId:id,detail:{reason}}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return NextResponse.json({message:active?'Administrator activated':'Administrator deactivated'},{headers:noCache});
  }catch(e){const code=e instanceof Error?e.message:'';if(code==='NOT_FOUND')return response('Platform administrator not found',404);if(code==='UNCHANGED')return response('Account already has that status',409);if(code==='PENDING_INVITE')return response('Pending invitations must be accepted through the emailed link',409);if(code==='LAST_ADMIN')return response('Cannot deactivate the last active platform administrator',409);console.error('Platform admin status change failed',e);return response('Unable to change administrator status',500)}
 }
 return response('Unsupported action',400);
}
