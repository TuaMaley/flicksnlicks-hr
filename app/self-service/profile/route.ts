import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';

const fields={id:true,employeeNo:true,firstName:true,lastName:true,email:true,phone:true,position:true,department:true,status:true,employmentType:true,hireDate:true,emergencyContact:true,branch:{select:{id:true,name:true}}} as const;
export async function GET(){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.can('selfservice.view'))return NextResponse.json({error:'Permission denied'},{status:403});
 if(!a.user.employeeId)return NextResponse.json({error:'Your login is not linked to an employee record. Contact HR.'},{status:404});
 const employee=await db.employee.findUnique({where:{id:a.user.employeeId},select:fields});
 if(!employee)return NextResponse.json({error:'Linked employee record not found'},{status:404});
 return NextResponse.json({employee});
}
export async function PATCH(request:Request){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.can('selfservice.edit'))return NextResponse.json({error:'Permission denied'},{status:403});
 if(!a.user.employeeId)return NextResponse.json({error:'Your login is not linked to an employee record'},{status:404});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'Invalid payload'},{status:400});
 const b=body as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['phone','emergencyContact'].includes(k)))return NextResponse.json({error:'Only phone and emergency contact may be edited here'},{status:400});
 if(!('phone'in b)&&!('emergencyContact'in b))return NextResponse.json({error:'No changes supplied'},{status:400});
 for(const k of ['phone','emergencyContact'])if(k in b&&(typeof b[k]!=='string'||(b[k] as string).length>150))return NextResponse.json({error:'Invalid '+k},{status:400});
 const existing=await db.employee.findUnique({where:{id:a.user.employeeId},select:{id:true}});
 if(!existing)return NextResponse.json({error:'Linked employee record not found'},{status:404});
 const data:{phone?:string|null;emergencyContact?:string|null}={};
 if('phone'in b)data.phone=(b.phone as string).trim()||null;
 if('emergencyContact'in b)data.emergencyContact=(b.emergencyContact as string).trim()||null;
 const employee=await db.$transaction(async tx=>{
  const updated=await tx.employee.update({where:{id:a.user!.employeeId!},data,select:fields});
  await tx.auditLog.create({data:{actorId:a.user!.id,action:'ESS_PROFILE_UPDATED',entity:'Employee',entityId:updated.id,detail:{fields:Object.keys(data)}}});
  return updated;
 });
 return NextResponse.json({employee});
}
