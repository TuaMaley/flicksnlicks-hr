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
 const admins=await db.user.findMany({where:{platformAdmin:true},select:{id:true,name:true,email:true,active:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'asc'}});
 return NextResponse.json({admins,currentUserId:actor.id},{headers:noCache});
}
export async function POST(req:NextRequest){
 const actor=await guard();if(!actor)return response('Platform administrator access required',403);
 const body=await req.json().catch(()=>null);
 if(!body||typeof body.action!=='string')return response('Invalid request',400);
 if(body.action==='invite'){
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(name.length<2||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return response('Enter a valid name and email',400);
  if(await db.user.findUnique({where:{email},select:{id:true}}))return response('An account with this email already exists. No permissions were changed.',409);
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
    const created=await tx.user.create({data:{name,email,platformAdmin:true,active:false,passwordHash:hashPassword(randomPassword)}});
    await tx.passwordResetToken.create({data:{userId:created.id,tokenHash:digestResetToken(token),expiresAt:new Date(Date.now()+24*60*60*1000)}});
    await tx.auditLog.create({data:{actorId:actor.id,action:'PLATFORM_ADMIN_INVITED',entity:'User',entityId:created.id,detail:{email}}});
    return created;
   });
   userId=user.id;
  }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return response('Email already exists',409);console.error('Platform invitation creation failed',e);return response('Unable to create invitation',500)}
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
