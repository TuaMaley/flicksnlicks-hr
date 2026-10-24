import {NextRequest} from 'next/server';
import {currentUser,hashPassword,verifyPassword} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {fail,ok} from '../../../../lib/http';
export async function POST(req:NextRequest){
 const user=await currentUser();if(!user)return fail('Unauthorized',401);
 let body:{currentPassword?:unknown;newPassword?:unknown};
 try{body=await req.json()}catch{return fail('Invalid request',400)}
 if(typeof body.currentPassword!=='string'||typeof body.newPassword!=='string')return fail('Password fields are required',400);
 if(body.newPassword.length<12||body.newPassword.length>128)return fail('New password must be 12–128 characters',400);
 const existing=await db.user.findUnique({where:{id:user.id},select:{passwordHash:true}});
 if(!existing||!verifyPassword(body.currentPassword,existing.passwordHash))return fail('Current password is incorrect',400);
 if(body.currentPassword===body.newPassword)return fail('Choose a different password',400);
 await db.user.update({where:{id:user.id},data:{passwordHash:hashPassword(body.newPassword)}});
 return ok({success:true});
}
