import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
type Ctx={params:Promise<{id:string}>};
const defaults=[
 {prompt:'How relevant was this training to your role?',category:'RELEVANCE'},
 {prompt:'How knowledgeable was the trainer?',category:'TRAINER'},
 {prompt:'How effective was the trainer’s delivery?',category:'TRAINER'},
 {prompt:'How useful were the learning materials?',category:'MATERIALS'},
 {prompt:'How confident are you applying what you learned?',category:'EFFECTIVENESS'},
 {prompt:'What should be improved?',category:'GENERAL',kind:'TEXT',required:false}
];
export async function GET(_req:NextRequest,{params}:Ctx){
 try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.view'))return fail('Forbidden',403);
 const {id}=await params;
 const training=await db.training.findUnique({where:{id},select:{id:true,title:true,status:true,trainer:true}});if(!training)return fail('Training not found',404);
 const questions=await db.trainingEvaluationQuestion.findMany({where:{trainingId:id},orderBy:[{sortOrder:'asc'},{createdAt:'asc'}]});
 const enrollments=await db.trainingEnrollment.findMany({where:{trainingId:id,status:{not:'WITHDRAWN'},employee:employeeWhere(a)},select:{id:true,employeeId:true,employee:{select:{firstName:true,lastName:true,employeeNo:true,department:true,branch:{select:{name:true}}}}}});
 const responses=await db.trainingEvaluationResponse.findMany({where:{trainingId:id,enrollmentId:{in:enrollments.map(x=>x.id)}},include:{answers:true},orderBy:{submittedAt:'desc'}});
 const canManage=a.can('training.edit');
 const summary=canManage?{eligible:enrollments.length,submitted:responses.length,averageRating:(()=>{const nums=responses.flatMap(r=>r.answers).filter(x=>x.rating!==null).map(x=>x.rating!);return nums.length?Math.round(nums.reduce((s,n)=>s+n,0)/nums.length*100)/100:null})()}:null;
 return ok({training,questions,enrollments,responses,summary,canManage,currentEmployeeId:a.user.employeeId});
 }catch(e){console.error('Training evaluation GET failed',e);return fail('Unable to load evaluations',500)}
}
export async function POST(req:NextRequest,{params}:Ctx){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.edit'))return fail('Forbidden',403);
 const {id}=await params;let body:any;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 const items=body?.questions;
 if(!Array.isArray(items)||items.length<1||items.length>40)return fail('Provide 1–40 evaluation questions',400);
 if(items.some((x:any)=>!x||typeof x.prompt!=='string'||!x.prompt.trim()||x.prompt.length>300||!['RATING','TEXT'].includes(x.kind)||typeof x.required!=='boolean'||typeof x.category!=='string'||x.category.length>50))return fail('Invalid evaluation question',400);
 try{await db.$transaction(async tx=>{
 const training=await tx.training.findUnique({where:{id},select:{id:true}});if(!training)throw Error('Training not found');
 const existing=await tx.trainingEvaluationResponse.count({where:{trainingId:id}});if(existing)throw Error('Cannot change questions after feedback has been submitted');
 await tx.trainingEvaluationQuestion.deleteMany({where:{trainingId:id}});
 await tx.trainingEvaluationQuestion.createMany({data:items.map((x:any,i:number)=>({trainingId:id,prompt:x.prompt.trim(),kind:x.kind,category:x.category.trim()||'GENERAL',required:x.required,sortOrder:i}))});
 await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_EVALUATION_QUESTIONS_UPDATED',entity:'Training',entityId:id,detail:{count:items.length}}});
 });return ok({saved:items.length});
 }catch(e:any){if(e.message==='Training not found')return fail(e.message,404);if(e.message?.startsWith('Cannot change'))return fail(e.message,409);console.error('Evaluation template POST failed',e);return fail('Unable to save evaluation template',500)}
}
