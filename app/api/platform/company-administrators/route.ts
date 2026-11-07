import {NextRequest,NextResponse} from 'next/server';
import {currentUser,hashPassword} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {appOrigin,digestResetToken,newResetToken} from '../../../../lib/passwordReset';
import {randomBytes} from 'node:crypto';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const actor=await currentUser();const admin=actor&&await db.user.findUnique({where:{id:actor.id},select:{active:true,platformAdmin:true}});
 if(!admin?.active||!admin.platformAdmin)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const name=typeof b?.name==='string'?b.name.trim():'';const email=typeof b?.email==='string'?b.email.trim().toLowerCase():'';
 if(name.length<2||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'Valid administrator name and email required'},{status:400});
 const company=await db.company.findUnique({where:{id:companyId},select:{id:true,name:true,active:true}});
 if(!company?.active)return NextResponse.json({error:'Select an active company'},{status:400});
 if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return NextResponse.json({error:'Resend email settings are missing'},{status:503});
 let origin:string;try{origin=appOrigin()}catch{return NextResponse.json({error:'NEXORA_APP_URL is not configured'},{status:503})}
 const existing=await db.user.findUnique({where:{email},include:{companyMemberships:true}});
 if(existing)return NextResponse.json({error:'This email already belongs to an existing account. Assign the existing user through Memberships & Access instead.'},{status:409});
 const token=newResetToken();const expiresAt=new Date(Date.now()+24*60*60*1000);
 let createdId='';
 try{
  const result=await db.$transaction(async tx=>{
   let role=await tx.role.findFirst({where:{companyId:company.id,name:`Administrator [${company.id}]`}});
   if(!role){const permissions=await tx.permission.findMany({select:{id:true}});if(!permissions.length)throw Error('Permission catalog not initialized');role=await tx.role.create({data:{name:`Administrator [${company.id}]`,companyId:company.id,description:'Company HRMS Administrator',system:true,protected:true,active:true,permissions:{create:permissions.map(p=>({permissionId:p.id}))}}})}
   const user=await tx.user.create({data:{name,email,passwordHash:hashPassword(randomBytes(48).toString('hex')),active:true,platformAdmin:false}});
   await tx.companyMembership.create({data:{companyId:company.id,userId:user.id,active:true,roles:{create:{roleId:role.id}}}});
   await tx.passwordResetToken.create({data:{userId:user.id,tokenHash:digestResetToken(token),expiresAt}});
   await tx.auditLog.create({data:{actorId:actor!.id,companyId:company.id,action:'PLATFORM_COMPANY_ADMIN_INVITED',entity:'User',entityId:user.id,detail:{email,companyId:company.id}}});return user;
  });createdId=result.id;
  const link=`${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:email,subject:`Welcome to Nexora — ${company.name}`,text:`Hello ${name},\n\nWelcome to Nexora! You have been invited to administer ${company.name}. Set your password using the secure link below (valid for 24 hours):\n${link}\n\nIf unexpected, contact your platform administrator.`,html:`<p>Hello ${escapeHtml(name)},</p><p>Welcome to Nexora! You have been invited to administer ${escapeHtml(company.name)}.</p><p><a href="${link}">Set up your password</a> (expires in 24 hours).</p><p>If unexpected, contact your platform administrator.</p>`})});
  if(!response.ok)throw Error(`Email delivery failed (${response.status})`);
  return NextResponse.json({success:true,message:'Administrator created and welcome invitation sent.'},{status:201});
 }catch(e){console.error('Company administrator invitation failed',e);if(createdId){await db.user.delete({where:{id:createdId}}).catch(err=>console.error('Failed to roll back unsent invitation',err))}return NextResponse.json({error:'Unable to complete administrator invitation. Check email configuration and retry.'},{status:500})}
}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
