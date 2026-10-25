import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {access,employeeWhere} from '../../../../../../lib/auth';
import {fail,ok} from '../../../../../../lib/http';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.create'))return fail('Forbidden',403);
 const {id}=await params;const d=await req.json().catch(()=>null);
 if(!d||typeof d.templateId!=='string')return fail('Select a template');
 const cycle=await db.appraisalCycle.findUnique({where:{id}});if(!cycle||cycle.status!=='OPEN')return fail('Cycle is unavailable');
 const template=await db.appraisalTemplate.findFirst({where:{id:d.templateId,active:true,deletedAt:null}});if(!template)return fail('Template unavailable');
 const scope=employeeWhere(a);
 const selected=Array.isArray(d.employeeIds)?d.employeeIds.filter((v:unknown):v is string=>typeof v==='string'):[];
 if(selected.length>500)return fail('Maximum 500 employees per assignment batch');
 const employees=await db.employee.findMany({where:{...scope,status:'ACTIVE',...(selected.length?{id:{in:selected}}:{}),...(typeof d.branchId==='string'&&d.branchId?{branchId:d.branchId}:{}),...(typeof d.department==='string'&&d.department?{department:d.department}:{})},select:{id:true}});
 if(selected.length&&employees.length!==new Set(selected).size)return fail('Some employees are outside your scope or inactive',403);
 if(!employees.length)return fail('No eligible employees found');
 // A transaction ensures an appraisal and assignment are created together for each employee.
 let created=0,skipped=0;
 for(const employee of employees){
  const exists=await db.appraisalCycleAssignment.findUnique({where:{cycleId_employeeId:{cycleId:id,employeeId:employee.id}}});
  if(exists){skipped++;continue}
  try{await db.$transaction(async tx=>{
   const review=await tx.appraisalReview.create({data:{employeeId:employee.id,templateId:template.id,period:cycle.period}});
   await tx.appraisalCycleAssignment.create({data:{cycleId:id,employeeId:employee.id,templateId:template.id,reviewId:review.id}});
  });created++}catch(e){throw e}
 }
 await db.auditLog.create({data:{actorId:a.user.id,action:'APPRAISAL_CYCLE_ASSIGN',entity:'AppraisalCycle',entityId:id}});
 return ok({created,skipped});
}
