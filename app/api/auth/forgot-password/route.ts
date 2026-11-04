import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {appOrigin,digestResetToken,newResetToken,RESET_WINDOW_MS,sendPasswordResetEmail} from '../../../../lib/passwordReset';
export const runtime='nodejs';
const generic={message:'If an active account exists for this email, a password reset link will be sent.'};
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>({}));
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(!email||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json(generic);
  const user=await db.user.findUnique({where:{email},select:{id:true,active:true}});
  if(!user?.active)return NextResponse.json(generic);
  // Database-backed per-account throttle, also works across Railway instances.
  const recent=await db.passwordResetToken.count({where:{userId:user.id,createdAt:{gte:new Date(Date.now()-60*60*1000)}}});
  if(recent>=3)return NextResponse.json(generic);
  const token=newResetToken();
  const row=await db.passwordResetToken.create({data:{userId:user.id,tokenHash:digestResetToken(token),expiresAt:new Date(Date.now()+RESET_WINDOW_MS)}});
  try{
   const link=`${appOrigin()}/reset-password?token=${token}`;
   await sendPasswordResetEmail(email,link);
  }catch(err){
   await db.passwordResetToken.delete({where:{id:row.id}}).catch(()=>{});
   console.error('Password reset delivery unavailable',err instanceof Error?err.message:'unknown error');
  }
  return NextResponse.json(generic);
 }catch(err){console.error('Password reset request failed',err);return NextResponse.json(generic)}
}
