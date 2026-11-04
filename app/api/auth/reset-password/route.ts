import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {hashPassword} from '../../../../lib/auth';
import {digestResetToken} from '../../../../lib/passwordReset';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>({}));
  const token=typeof body.token==='string'?body.token:'';
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[a-f0-9]{64}$/.test(token)||password.length<12||password.length>128)return NextResponse.json({error:'Invalid link or password. Use a password of 12–128 characters.'},{status:400});
  const hash=digestResetToken(token);
  const now=new Date();
  // Atomic conditional claim prevents reusing the same reset token.
  const result=await db.$transaction(async tx=>{
   const row=await tx.passwordResetToken.findUnique({where:{tokenHash:hash},select:{id:true,userId:true,expiresAt:true,usedAt:true,user:{select:{active:true}}}});
   if(!row||row.usedAt||row.expiresAt<=now||!row.user.active)return false;
   const claim=await tx.passwordResetToken.updateMany({where:{id:row.id,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}});
   if(claim.count!==1)return false;
   await tx.user.update({where:{id:row.userId},data:{passwordHash:hashPassword(password)}});
   await tx.passwordResetToken.updateMany({where:{userId:row.userId,usedAt:null},data:{usedAt:now}});
   return true;
  });
  if(!result)return NextResponse.json({error:'This reset link is invalid or has expired. Request a new one.'},{status:400});
  return NextResponse.json({message:'Password updated. You can now sign in.'});
 }catch(err){console.error('Password reset failed',err);return NextResponse.json({error:'Unable to reset password'},{status:500})}
}
