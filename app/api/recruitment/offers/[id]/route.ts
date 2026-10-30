import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.approve'))return fail('Forbidden',403);const {id}=await ctx.params;const b=await req.json();const action=String(b.action||'');
 const offer=await db.recruitmentOffer.findFirst({where:{id,application:{vacancy:{branch:{employees:{some:employeeWhere(a)}}}}},include:{application:{include:{candidate:true,vacancy:{include:{requisition:true}}}}}});
 if(!offer)return fail('Offer not found in your scope',404);
 const transitions:Record<string,{from:string;to:string}>={APPROVE:{from:'PENDING_APPROVAL',to:'APPROVED'},REJECT:{from:'PENDING_APPROVAL',to:'REJECTED'},ACCEPT:{from:'APPROVED',to:'ACCEPTED'},DECLINE:{from:'APPROVED',to:'DECLINED'},HIRE:{from:'ACCEPTED',to:'HIRED'}};
 const transition=transitions[action];if(!transition)return fail('Invalid action',400);if(offer.status!==transition.from)return fail('Offer is not in the required status',409);
 if((action==='APPROVE'||action==='REJECT')&&offer.createdById===a.user.id)return fail('Offer creator cannot approve or reject their own offer',403);
 const note=String(b.note||'').trim();if(note.length>2000)return fail('Note too long',400);if(action==='REJECT'&&note.length<3)return fail('Rejection reason is required',400);
 if(action==='HIRE'){
  const employeeNo=String(b.employeeNo||'').trim();if(!/^[A-Za-z0-9_-]{2,40}$/.test(employeeNo))return fail('Enter a unique employee number (2–40 letters, digits, hyphen or underscore)',400);
  const candidate=offer.application.candidate;const requisition=offer.application.vacancy.requisition;
  if(await db.employee.findFirst({where:{OR:[{employeeNo},{email:{equals:candidate.email,mode:'insensitive'}}]}}))return fail('Employee number or email already exists; check Employee Management',409);
  const result=await db.$transaction(async tx=>{
   const claimed=await tx.recruitmentOffer.updateMany({where:{id,status:'ACCEPTED',employeeId:null},data:{status:'PROCESSING'}});if(!claimed.count)return null;
   const employee=await tx.employee.create({data:{employeeNo,firstName:candidate.firstName,lastName:candidate.lastName,email:candidate.email,phone:candidate.phone,position:offer.application.vacancy.title,department:requisition.department,branchId:offer.application.vacancy.branchId,employmentType:requisition.employmentType,hireDate:offer.startDate}});
   await tx.recruitmentOffer.update({where:{id},data:{status:'HIRED',employeeId:employee.id}});
   await tx.recruitmentApplication.update({where:{id:offer.applicationId},data:{status:'HIRED'}});
   await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_EMPLOYEE_CONVERTED',entity:'Employee',entityId:employee.id,detail:{offerId:id,applicationId:offer.applicationId,employeeNo}}});return employee;
  });if(!result)return fail('Offer changed; refresh',409);return ok({employee:result});
 }
 const result=await db.$transaction(async tx=>{const claimed=await tx.recruitmentOffer.updateMany({where:{id,status:transition.from},data:{status:transition.to,...(action==='APPROVE'||action==='REJECT'?{approvedById:a.user!.id,approvedAt:new Date(),approvalNote:note}:{respondedAt:new Date()})}});if(!claimed.count)return null;await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_OFFER_'+action,entity:'RecruitmentOffer',entityId:id,detail:{note}}});return tx.recruitmentOffer.findUnique({where:{id}})});if(!result)return fail('Offer changed; refresh',409);return ok({offer:result});
 }catch(e){console.error('Recruitment offer PATCH',e);return fail('Unable to update offer; check for duplicate employee data',500)}}
