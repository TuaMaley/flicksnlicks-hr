import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

const hr=(a:Awaited<ReturnType<typeof access>>)=>Boolean(a.user?.roles.some(r=>r.role.active&&['HR Manager','Administrator'].includes(r.role.name)));
const manager=(a:Awaited<ReturnType<typeof access>>)=>Boolean(a.user?.roles.some(r=>r.role.active&&['HR Manager','Administrator','Branch Manager'].includes(r.role.name)));
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!manager(a)||!a.can('appraisals.edit'))return fail('Forbidden',403);
 const {id}=await params;let d:any;try{d=await req.json()}catch{return fail('Invalid JSON',400)}
 const row=await db.performanceImprovementPlan.findFirst({where:{id,employee:employeeWhere(a)}});if(!row)return fail('Plan not found in your reporting scope',404);
 if(row.employeeId===a.user.employeeId)return fail('Self-approval is not allowed',403);
 const action=String(d.action||'');
 if(action==='activate'){
  if(row.status!=='DRAFT')return fail('Only draft plans can be activated',409);
  const updated=await db.$transaction(async tx=>{const p=await tx.performanceImprovementPlan.update({where:{id},data:{status:'ACTIVE'}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'PIP_ACTIVATED',entity:'PerformanceImprovementPlan',entityId:id}});return p});return ok(updated);
 }
 if(action==='checkin'){
  if(row.status!=='ACTIVE')return fail('Only active plans accept progress reviews',409);
  const note=String(d.progressNote||'').trim();const progress=Number(d.progressPercent);const nextSteps=String(d.nextSteps||'').trim();
  if(note.length<10||note.length>3000||!Number.isInteger(progress)||progress<0||progress>100||nextSteps.length>2000)return fail('Provide progress notes (10+ characters) and progress from 0 to 100',400);
  const result=await db.$transaction(async tx=>{const c=await tx.performanceImprovementCheckIn.create({data:{planId:id,authorId:a.user!.id,progressNote:note,progressPercent:progress,nextSteps}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'PIP_CHECKIN',entity:'PerformanceImprovementPlan',entityId:id,detail:{progressPercent:progress}}});return c});return ok(result);
 }
 if(action==='close'){
  if(!hr(a)||!a.can('appraisals.approve'))return fail('Only authorized HR/Administrators may close plans',403);
  if(row.status!=='ACTIVE')return fail('Only active plans can be closed',409);
  const outcome=String(d.outcome||'');const note=String(d.outcomeNote||'').trim();
  if(!['COMPLETED','UNSUCCESSFUL','CANCELLED'].includes(outcome)||note.length<15||note.length>3000)return fail('Choose an outcome and provide a reason (15+ characters)',400);
  const updated=await db.$transaction(async tx=>{const p=await tx.performanceImprovementPlan.update({where:{id},data:{status:outcome,closedById:a.user!.id,closedAt:new Date(),outcomeNote:note}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'PIP_CLOSED',entity:'PerformanceImprovementPlan',entityId:id,detail:{outcome,note}}});return p});return ok(updated);
 }
 return fail('Unknown action',400);
}
