import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/db';
import {hashPassword} from '../../../../../lib/auth';
import {digestResetToken} from '../../../../../lib/passwordReset';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 const token=typeof body?.token==='string'?body.token:'';
 const password=typeof body?.password==='string'?body.password:'';
 if(!/^[a-f0-9]{64}$/.test(token)||password.length<12||password.length>128)return NextResponse.json({error:'Invalid invitation or password (12–128 characters required)'},{status:400});
 try{
  const success=await db.$transaction(async tx=>{
   const row=await tx.passwordResetToken.findUnique({where:{tokenHash:digestResetToken(token)},select:{id:true,userId:true,expiresAt:true,usedAt:true,user:{select:{active:true,platformAdmin:true}}}});
   if(!row||row.usedAt||row.expiresAt<=new Date()||row.user.active||!row.user.platformAdmin)return false;
   const claim=await tx.passwordResetToken.updateMany({where:{id:row.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});
   if(claim.count!==1)return false;
   await tx.user.update({where:{id:row.userId},data:{passwordHash:hashPassword(password),active:true}});
   await tx.passwordResetToken.updateMany({where:{userId:row.userId,usedAt:null},data:{usedAt:new Date()}});
   await tx.auditLog.create({data:{actorId:row.userId,action:'PLATFORM_ADMIN_INVITATION_ACCEPTED',entity:'User',entityId:row.userId}});
   return true;
  });
  if(!success)return NextResponse.json({error:'Invitation expired, already used, or invalid'},{status:400});
  return NextResponse.json({message:'Password set. You can now sign in.'});
 }catch(e){console.error('Platform invite acceptance failed',e);return NextResponse.json({error:'Unable to accept invitation'},{status:500})}
}
