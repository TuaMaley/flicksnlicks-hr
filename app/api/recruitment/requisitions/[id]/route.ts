import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';

export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try {const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('recruitment.approve'))return fail('Forbidden',403);
 const {id}=await ctx.params;const b=await req.json();
 const item=await db.recruitmentRequisition.findFirst({where:{id,branch:{employees:{some:employeeWhere(a)}}}});
 if(!item)return fail('Requisition not found or outside scope',404);
 const note=typeof b.note==='string'?b.note.trim():'';
 if(note.length>2000)return fail('Note is too long',400);
 let data:any;let action:string;
 if(item.status==='PENDING_HR'&&b.action==='HR_APPROVE'){
 data={status:'PENDING_MANAGEMENT',hrReviewedById:a.user.id,hrReviewedAt:new Date(),hrNote:note};action='RECRUITMENT_HR_REVIEWED';
 }else if(item.status==='PENDING_HR'&&b.action==='HR_REJECT'){
 if(!note)return fail('Reason required',400);
 data={status:'REJECTED',hrReviewedById:a.user.id,hrReviewedAt:new Date(),hrNote:note};action='RECRUITMENT_HR_REJECTED';
 }else if(item.status==='PENDING_MANAGEMENT'&&['APPROVE','REJECT'].includes(b.action)){
 if(item.requestedById===a.user.id||item.hrReviewedById===a.user.id)return fail('Independent management approver required',403);
 if(b.action==='REJECT'&&!note)return fail('Reason required',400);
 data={status:b.action==='APPROVE'?'APPROVED':'REJECTED',decidedById:a.user.id,decidedAt:new Date(),managementNote:note};action='RECRUITMENT_MANAGEMENT_'+b.action;
 }else return fail('Invalid action for current workflow stage',409);
 const result=await db.$transaction(async tx=>{
 const changed=await tx.recruitmentRequisition.updateMany({where:{id,status:item.status},data});
 if(changed.count!==1)return null;
 await tx.auditLog.create({data:{actorId:a.user!.id,action,entity:'RecruitmentRequisition',entityId:id,detail:{from:item.status,to:data.status,note}}});
 return tx.recruitmentRequisition.findUnique({where:{id}});
 });
 if(!result)return fail('Requisition was updated by another user. Refresh.',409);
 return ok({requisition:result});
 }catch(e){console.error('Recruitment approval PATCH',e);return fail('Unable to update requisition',500)}
}
