import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {ok,fail} from '../../../../lib/http';
const types=['ALLEGATION','HEARING_INVITATION','VERBAL_WARNING','WRITTEN_WARNING','FINAL_WARNING','SUSPENSION','DECISION','APPEAL_OUTCOME'];
const str=(x:unknown,max=10000)=>typeof x==='string'?x.trim().slice(0,max):'';
export async function GET(req:NextRequest){
 try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('disciplinary.view'))return fail('Forbidden',403);
 const caseId=req.nextUrl.searchParams.get('caseId');if(!caseId)return fail('Select a case',400);
 const c=await db.disciplinaryCase.findFirst({where:{id:caseId,employee:employeeWhere(a)},include:{employee:{select:{employeeNo:true,firstName:true,lastName:true,department:true,branch:{select:{name:true}}}}}});if(!c)return fail('Case unavailable',404);
 const [letters,approvals,notices,history]=await Promise.all([
 db.disciplinaryLetter.findMany({where:{caseId},orderBy:{createdAt:'desc'}}),
 db.disciplinaryApprovalRequest.findMany({where:{caseId},orderBy:{createdAt:'desc'}}),
 db.disciplinaryNotice.findMany({where:{caseId,recipientUserId:a.user.id},orderBy:{createdAt:'desc'}}),
 db.disciplinaryCase.findMany({where:{employeeId:c.employeeId,employee:employeeWhere(a)},select:{id:true,summary:true,status:true,incidentDate:true,policyOffenceCode:true,sanctionApplied:true,policyVersion:true,createdAt:true,appeals:{select:{status:true,outcome:true}}},orderBy:{incidentDate:'desc'},take:100})]);
 return ok({case:c,letters,approvals,notices,history});
 }catch(e){console.error('Phase4 GET',e);return fail('Unable to load phase 4 records',500)}
}
export async function POST(req:NextRequest){
 try{const a=await access();if(!a.user)return fail('Unauthorized',401);const b=await req.json();const caseId=str(b.caseId,100);if(!caseId)return fail('Case required',400);
 const c=await db.disciplinaryCase.findFirst({where:{id:caseId,employee:employeeWhere(a)}});if(!c)return fail('Case unavailable',404);
 if(b.type==='letter'){
 if(!a.can('disciplinary.edit'))return fail('Forbidden',403);if(!types.includes(b.letterType)||str(b.subject,200).length<5||str(b.body).length<15)return fail('Valid letter type, subject and body required',400);
 const item=await db.$transaction(async tx=>{const x=await tx.disciplinaryLetter.create({data:{caseId,letterType:b.letterType,subject:str(b.subject,200),body:str(b.body),createdById:a.user!.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'DISCIPLINARY_LETTER_DRAFTED',entity:'DisciplinaryLetter',entityId:x.id,detail:{caseId,letterType:x.letterType}}});return x});return ok({item},201)}
 if(b.type==='request'){
 if(!a.can('disciplinary.edit'))return fail('Forbidden',403);if(!['SANCTION','LETTER_ISSUANCE'].includes(b.actionType)||str(b.proposal,2000).length<5||str(b.reason,2000).length<10)return fail('Valid action, proposal and reason required',400);
 const item=await db.$transaction(async tx=>{const x=await tx.disciplinaryApprovalRequest.create({data:{caseId,requestedById:a.user!.id,actionType:b.actionType,proposal:str(b.proposal,2000),reason:str(b.reason,2000)}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'DISCIPLINARY_APPROVAL_REQUESTED',entity:'DisciplinaryApprovalRequest',entityId:x.id,detail:{caseId,actionType:x.actionType}}});return x});return ok({item},201)}
 if(b.type==='review'){
 if(!a.can('disciplinary.approve'))return fail('Approval permission required',403);if(!['APPROVED','REJECTED'].includes(b.status)||str(b.reviewNote,2000).length<5)return fail('Decision and review note required',400);
 const item=await db.$transaction(async tx=>{const old=await tx.disciplinaryApprovalRequest.findFirst({where:{id:str(b.id,100),caseId,status:'PENDING'}});if(!old)throw Error('Request is no longer pending');if(old.requestedById===a.user!.id)throw Error('Self-approval is not permitted');const x=await tx.disciplinaryApprovalRequest.update({where:{id:old.id},data:{status:b.status,reviewNote:str(b.reviewNote,2000),reviewedById:a.user!.id,reviewedAt:new Date()}});await tx.disciplinaryNotice.create({data:{caseId,recipientUserId:old.requestedById,message:`${x.actionType} request ${x.status.toLowerCase()}: ${x.reviewNote}`.slice(0,1000)}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'DISCIPLINARY_APPROVAL_REVIEWED',entity:'DisciplinaryApprovalRequest',entityId:x.id,detail:{caseId,status:x.status}}});return x});return ok({item})}
 if(b.type==='issue'){
 if(!a.can('disciplinary.approve'))return fail('Approval permission required',403);
 const item=await db.$transaction(async tx=>{const letter=await tx.disciplinaryLetter.findFirst({where:{id:str(b.id,100),caseId,status:'DRAFT'}});if(!letter)throw Error('Draft letter not found');const approval=await tx.disciplinaryApprovalRequest.findFirst({where:{caseId,actionType:'LETTER_ISSUANCE',status:'APPROVED',proposal:letter.id}});if(!approval)throw Error('An approved issuance request referencing the letter ID is required');const x=await tx.disciplinaryLetter.update({where:{id:letter.id},data:{status:'ISSUED',issuedAt:new Date(),issuedById:a.user!.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'DISCIPLINARY_LETTER_ISSUED',entity:'DisciplinaryLetter',entityId:x.id,detail:{caseId}}});return x});return ok({item})}
 if(b.type==='read'){
 const item=await db.disciplinaryNotice.updateMany({where:{id:str(b.id,100),caseId,recipientUserId:a.user.id,readAt:null},data:{readAt:new Date()}});return ok({updated:item.count})}
 return fail('Unknown action',400);
 }catch(e){console.error('Phase4 POST',e);return fail(e instanceof Error&&['Request is no longer pending','Self-approval is not permitted','Draft letter not found','An approved issuance request referencing the letter ID is required'].includes(e.message)?e.message:'Unable to complete action',409)}
}
