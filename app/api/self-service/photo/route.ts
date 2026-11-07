import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
/**
 * Employee profile photo (self-service). Stored as a data URL on Employee.profilePhotoDataUrl (the same column HR uses).
 * POST {dataUrl} — JPEG/PNG/WebP, ≤400 KB encoded. DELETE — remove.
 * Requires selfservice.edit; the user may only change their own linked employee record.
 */
const MAX=400*1024;
async function guard(){
 const a=await access();
 if(!a.user)return {err:NextResponse.json({error:'Authentication required'},{status:401})};
 if(!a.companyId)return {err:NextResponse.json({error:'Company context required'},{status:403})};
 if(!a.can('selfservice.edit'))return {err:NextResponse.json({error:'Permission denied'},{status:403})};
 if(!a.user.employeeId)return {err:NextResponse.json({error:'Your login is not linked to an employee record'},{status:404})};
 const existing=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{id:true}});
 if(!existing)return {err:NextResponse.json({error:'Linked employee record not found'},{status:404})};
 return {a,id:existing.id};
}
export async function POST(request:Request){
 const g=await guard();if('err'in g)return g.err;
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 const dataUrl=(body as {dataUrl?:unknown})?.dataUrl;
 if(typeof dataUrl!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl))return NextResponse.json({error:'Photo must be a JPEG, PNG or WebP image'},{status:400});
 if(dataUrl.length>MAX)return NextResponse.json({error:'Photo is too large (max 400 KB). Please choose a smaller image.'},{status:413});
 await db.$transaction(async tx=>{
  await tx.employee.update({where:{id:g.id,companyId:g.a.companyId!},data:{profilePhotoDataUrl:dataUrl}});
  await tx.auditLog.create({data:{actorId:g.a.user!.id,companyId:g.a.companyId!,action:'ESS_PHOTO_UPDATED',entity:'Employee',entityId:g.id,detail:{bytes:dataUrl.length}}});
 });
 return NextResponse.json({ok:true});
}
export async function DELETE(){
 const g=await guard();if('err'in g)return g.err;
 await db.$transaction(async tx=>{
  await tx.employee.update({where:{id:g.id,companyId:g.a.companyId!},data:{profilePhotoDataUrl:null}});
  await tx.auditLog.create({data:{actorId:g.a.user!.id,companyId:g.a.companyId!,action:'ESS_PHOTO_REMOVED',entity:'Employee',entityId:g.id,detail:{}}});
 });
 return NextResponse.json({ok:true});
}
