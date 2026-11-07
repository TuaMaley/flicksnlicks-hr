import {access,employeeWhere} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
import {readEmployeePhoto} from '../../../../../lib/employeePhoto';
import {NextResponse} from 'next/server';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId||!a.can('employees.edit'))return NextResponse.json({error:'Forbidden'},{status:403});
 if(!a.user.roles.some(r=>r.role.active&&(r.role.name==='Administrator'||r.role.name==='HR Manager')))return NextResponse.json({error:'Only HR or administrators may update employee photos'},{status:403});
 const {id}=await params;
 const old=await db.employee.findFirst({where:{AND:[{id},employeeWhere(a)]},select:{id:true}});
 if(!old)return NextResponse.json({error:'Employee not found'},{status:404});
 let photo:string;try{photo=await readEmployeePhoto(req)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
 const result=await db.$transaction(async tx=>{
  const changed=await tx.employee.updateMany({where:{id,companyId:a.companyId!},data:{profilePhotoDataUrl:photo}});
  if(changed.count!==1)return false;
  await tx.auditLog.create({data:{companyId:a.companyId!,actorId:a.user!.id,action:'EMPLOYEE_PROFILE_PHOTO_UPDATED',entity:'Employee',entityId:id,detail:{fields:['profilePhotoDataUrl']}}});return true;
 });
 if(!result)return NextResponse.json({error:'Employee not found'},{status:404});
 return NextResponse.json({profilePhotoDataUrl:photo});
}
