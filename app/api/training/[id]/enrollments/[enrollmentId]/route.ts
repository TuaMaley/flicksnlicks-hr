import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {access,employeeWhere} from '../../../../../../lib/auth';
import {fail,ok} from '../../../../../../lib/http';
type Ctx={params:Promise<{id:string;enrollmentId:string}>};
export async function PATCH(req:NextRequest,{params}:Ctx){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.edit'))return fail('Forbidden',403);
 const {id,enrollmentId}=await params;let body:any;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 if(!['ENROLLED','WITHDRAWN','COMPLETED'].includes(body?.status))return fail('Invalid enrollment status',400);
 const existing=await db.trainingEnrollment.findFirst({where:{id:enrollmentId,trainingId:id,employee:employeeWhere(a)}});if(!existing)return fail('Enrollment not found or access denied',404);
 try{const updated=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
  if(existing.status==='WITHDRAWN'&&body.status==='ENROLLED'){
   const t=await tx.training.findUnique({where:{id}});if(!t||t.status==='CANCELLED')throw Error('Training unavailable');
   const count=await tx.trainingEnrollment.count({where:{trainingId:id,status:{not:'WITHDRAWN'}}});if(t.maxParticipants!=null&&count>=t.maxParticipants)throw Error('Training capacity reached');
  }
  const record=await tx.trainingEnrollment.update({where:{id:enrollmentId},data:{status:body.status}});
  await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_ENROLLMENT_STATUS_CHANGED',entity:'TrainingEnrollment',entityId:enrollmentId,detail:{from:existing.status,to:body.status,trainingId:id,employeeId:existing.employeeId}}});return record;
 });return ok({enrollment:updated})}catch(e:any){if(['Training unavailable','Training capacity reached'].includes(e?.message))return fail(e.message,409);return fail('Unable to update enrollment',500)}
}
