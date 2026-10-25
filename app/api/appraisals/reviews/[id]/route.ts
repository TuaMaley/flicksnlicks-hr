import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
import {weightedScore,Criterion} from '../../../../../lib/appraisal-templates';

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const a=await access(); if(!a.user)return fail('Unauthorized',401);
 const {id}=await params;
 const d=await req.json().catch(()=>null);
 if(!d||typeof d.action!=='string')return fail('Invalid action',400);
 const row=await db.appraisalReview.findFirst({where:{id,employee:employeeWhere(a)},include:{template:true}});
 if(!row)return fail('Appraisal not found or outside your scope',404);
 const roles=a.user.roles.filter(x=>x.role.active).map(x=>x.role.name);
 const isHR=roles.includes('HR Manager')||roles.includes('Administrator');
 const isManager=roles.includes('Branch Manager')||a.can('appraisals.edit');
 const mayApproveManager=roles.includes('Branch Manager')||a.can('appraisals.approve');
 const self=row.employeeId===a.user.employeeId;
 const reason=typeof d.comment==='string'?d.comment.trim():'';
 const criteria=row.template.criteria as Criterion[];
 let data:any={};
 if(d.action==='self') {
   if(!self||!['DRAFT','REJECTED'].includes(row.status))return fail('Not allowed',403);
   if(row.managerScores!==null)return fail('This appraisal has already been evaluated by a manager',409);
   if(weightedScore(criteria,d.scores||{})===null)return fail('Score each KPI from 1 to 5',400);
   data={selfScores:d.scores,selfComment:reason.slice(0,2000),status:'SUBMITTED'};
 } else if(d.action==='manager') {
   if(self||!isManager||!['SUBMITTED','MANAGER_REVIEWED'].includes(row.status))return fail('Not allowed',403);
   const score=weightedScore(criteria,d.scores||{});
   if(score===null)return fail('Score each KPI from 1 to 5',400);
   data={managerScores:d.scores,managerComment:reason.slice(0,2000),score,reviewerId:a.user.id,status:'MANAGER_REVIEWED'};
 } else if(d.action==='approve') {
   if(self||!mayApproveManager||row.status!=='MANAGER_REVIEWED'||row.score===null||row.managerScores===null)return fail('Manager evaluation must be saved first',403);
   data={status:'PENDING_HR_APPROVAL',approvedBy:a.user.id,approvedAt:new Date()};
 } else if(d.action==='finalize') {
   if(!isHR||self||row.status!=='PENDING_HR_APPROVAL'||!row.approvedBy||row.score===null)return fail('Only HR can finalize manager-approved appraisals',403);
   if(row.approvedBy===a.user.id)return fail('A different authorized HR user must finalize this appraisal',403);
   data={status:'FINALIZED'};
 } else if(d.action==='reject') {
   if(reason.length<10)return fail('Provide a rejection reason of at least 10 characters',400);
   if(row.status==='PENDING_HR_APPROVAL') {
     if(!isHR||self||row.approvedBy===a.user.id)return fail('Not allowed',403);
     data={status:'MANAGER_REVIEWED',approvedBy:null,approvedAt:null};
   } else if(['SUBMITTED','MANAGER_REVIEWED'].includes(row.status)) {
     if(self||!mayApproveManager)return fail('Not allowed',403);
     data={status:'REJECTED',managerScores:null,managerComment:null,score:null,reviewerId:null,approvedBy:null,approvedAt:null};
   } else return fail('This appraisal cannot be rejected at its current stage',409);
 } else return fail('Unknown action',400);
 const result=await db.$transaction(async tx=>{
   // Conditional update prevents concurrent approvals/finalization from changing a stale state.
   const updated=await tx.appraisalReview.updateMany({where:{id,status:row.status},data});
   if(updated.count!==1)return null;
   await tx.auditLog.create({data:{actorId:a.user!.id,action:'APPRAISAL_'+d.action.toUpperCase(),entity:'AppraisalReview',entityId:id,detail:{from:row.status,to:data.status,reason:d.action==='reject'?reason.slice(0,2000):undefined}}});
   return tx.appraisalReview.findUnique({where:{id}});
 });
 if(!result)return fail('Appraisal changed. Refresh and try again.',409);
 return ok({review:result});
}
