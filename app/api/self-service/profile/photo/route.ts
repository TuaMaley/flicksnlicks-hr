import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
import {readEmployeePhoto} from '../../../../../lib/employeePhoto';
import {NextResponse} from 'next/server';
export async function POST(req:Request){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.companyId||!a.user.employeeId)return NextResponse.json({error:'Employee profile unavailable'},{status:403});
 if(!a.can('selfservice.edit'))return NextResponse.json({error:'Permission denied'},{status:403});
 let photo:string;try{photo=await readEmployeePhoto(req)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
 const result=await db.$transaction(async tx=>{
  const changed=await tx.employee.updateMany({where:{id:a.user!.employeeId!,companyId:a.companyId!},data:{profilePhotoDataUrl:photo}});
  if(changed.count!==1)return false;
  await tx.auditLog.create({data:{companyId:a.companyId!,actorId:a.user!.id,action:'ESS_PROFILE_PHOTO_UPDATED',entity:'Employee',entityId:a.user!.employeeId!,detail:{fields:['profilePhotoDataUrl']}}});return true;
 });
 if(!result)return NextResponse.json({error:'Employee record not found'},{status:404});
 return NextResponse.json({profilePhotoDataUrl:photo});
}
