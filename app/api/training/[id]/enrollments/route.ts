import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
type Ctx={params:Promise<{id:string}>};
export async function GET(_req:NextRequest,{params}:Ctx){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.view'))return fail('Forbidden',403);
 const {id}=await params;const training=await db.training.findUnique({where:{id},select:{id:true,title:true,maxParticipants:true}});if(!training)return fail('Training not found',404);
 const enrollments=await db.trainingEnrollment.findMany({where:{trainingId:id,employee:employeeWhere(a)},include:{employee:{select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,position:true,branch:{select:{name:true}}}}},orderBy:{enrolledAt:'desc'}});
 return ok({training,enrollments});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.create'))return fail('Forbidden',403);
 const {id}=await params;let body:any;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 const ids=body?.employeeIds;if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some((x:unknown)=>typeof x!=='string')||new Set(ids).size!==ids.length)return fail('Provide 1–500 unique employee IDs',400);
 try{const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
  const training=await tx.training.findUnique({where:{id}});if(!training)throw Error('Training not found');if(training.status==='CANCELLED')throw Error('Cannot enroll in cancelled training');
  const employees=await tx.employee.findMany({where:{AND:[{id:{in:ids},status:'ACTIVE'},employeeWhere(a)]},select:{id:true}});
  if(employees.length!==ids.length)throw Error('Some employees are inactive or outside your authorized scope');
  const existing=await tx.trainingEnrollment.findMany({where:{trainingId:id,employeeId:{in:ids}},select:{employeeId:true,status:true}});
  if(existing.length)throw Error('One or more employees are already enrolled or have an enrollment history');
  const current=await tx.trainingEnrollment.count({where:{trainingId:id,status:{not:'WITHDRAWN'}}});
  if(training.maxParticipants!=null&&current+ids.length>training.maxParticipants)throw Error('Enrollment exceeds training capacity');
  await tx.trainingEnrollment.createMany({data:ids.map((employeeId:string)=>({trainingId:id,employeeId,enrolledById:a.user!.id}))});
  await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_EMPLOYEES_ENROLLED',entity:'Training',entityId:id,detail:{employeeIds:ids,count:ids.length}}});
  return {created:ids.length};
 });return ok(result,201)}catch(e:any){if(e?.code==='P2002')return fail('An employee is already enrolled',409);if(['Training not found','Cannot enroll in cancelled training','Some employees are inactive or outside your authorized scope','One or more employees are already enrolled or have an enrollment history','Enrollment exceeds training capacity'].includes(e?.message))return fail(e.message,400);console.error(e);return fail('Unable to enroll employees',500)}
}
