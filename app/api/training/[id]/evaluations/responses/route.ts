import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {access,employeeWhere} from '../../../../../../lib/auth';
import {fail,ok} from '../../../../../../lib/http';
type Ctx={params:Promise<{id:string}>};
export async function POST(req:NextRequest,{params}:Ctx){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.view'))return fail('Forbidden',403);
 const {id}=await params;let body:any;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 const enrollmentId=body?.enrollmentId;const answers=body?.answers;
 if(typeof enrollmentId!=='string'||!Array.isArray(answers)||answers.length>40)return fail('Invalid feedback submission',400);
 if(answers.some((x:any)=>!x||typeof x.questionId!=='string'||(x.rating!==null&&x.rating!==undefined&&(!Number.isInteger(x.rating)||x.rating<1||x.rating>5))||(x.comment!==null&&x.comment!==undefined&&(typeof x.comment!=='string'||x.comment.length>2000))))return fail('Invalid answer values',400);
 if(new Set(answers.map((x:any)=>x.questionId)).size!==answers.length)return fail('Duplicate answers',400);
 try{const result=await db.$transaction(async tx=>{
 const training=await tx.training.findUnique({where:{id},select:{status:true}});if(!training)throw Error('Training not found');if(training.status!=='COMPLETED')throw Error('Feedback opens when the training is completed');
 const enrollment=await tx.trainingEnrollment.findFirst({where:{id:enrollmentId,trainingId:id,status:{not:'WITHDRAWN'},employee:employeeWhere(a)},select:{id:true,employeeId:true}});if(!enrollment)throw Error('Enrollment not found or access denied');
 // A participant may submit only their own evaluation; training editors can record on behalf of participants.
 if(!a.can('training.edit')&&a.user!.employeeId!==enrollment.employeeId)throw Error('Only your own evaluation may be submitted');
 const questions=await tx.trainingEvaluationQuestion.findMany({where:{trainingId:id}});if(!questions.length)throw Error('Evaluation form has not been configured');
 const byQuestion=new Map(answers.map((x:any)=>[x.questionId,x]));
 for(const q of questions){const ans:any=byQuestion.get(q.id);if(q.required&&(!ans||(q.kind==='RATING'&&!Number.isInteger(ans.rating))||(q.kind==='TEXT'&&!ans.comment?.trim())))throw Error('Please answer all required questions');if(ans&&q.kind==='RATING'&&ans.rating==null)throw Error('A rating is required for rating questions');if(ans&&q.kind==='TEXT'&&ans.rating!=null)throw Error('Text questions cannot have ratings')}
 if(answers.some((x:any)=>!questions.some(q=>q.id===x.questionId)))throw Error('Answer contains an unknown question');
 const response=await tx.trainingEvaluationResponse.create({data:{trainingId:id,enrollmentId,employeeId:enrollment.employeeId,answers:{create:answers.map((x:any)=>({questionId:x.questionId,rating:x.rating??null,comment:x.comment?.trim()||null}))}}});
 await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_EVALUATION_SUBMITTED',entity:'TrainingEvaluationResponse',entityId:response.id,detail:{trainingId:id,enrollmentId}}});
 return response;
 });return ok({responseId:result.id},201);
 }catch(e:any){if(e.code==='P2002')return fail('Feedback has already been submitted for this participant',409);if(['Training not found','Feedback opens when the training is completed','Enrollment not found or access denied','Only your own evaluation may be submitted','Evaluation form has not been configured','Please answer all required questions','A rating is required for rating questions','Text questions cannot have ratings','Answer contains an unknown question'].includes(e.message))return fail(e.message,400);console.error('Evaluation submission failed',e);return fail('Unable to submit feedback',500)}
}
