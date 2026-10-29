import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
const scoped=(a:Awaited<ReturnType<typeof access>>)=>({vacancy:{branch:{employees:{some:employeeWhere(a)}}}});
export async function GET(){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.view'))return fail('Forbidden',403);
 const interviews=await db.recruitmentInterview.findMany({where:{application:scoped(a)},include:{application:{include:{candidate:{select:{firstName:true,lastName:true,email:true}},vacancy:{select:{title:true,branch:{select:{name:true}}}}}},assessments:true},orderBy:{scheduledAt:'desc'},take:300});return ok({interviews});
 }catch(e){console.error('Recruitment interviews GET',e);return fail('Unable to load interviews',500)}}
export async function POST(req:NextRequest){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.approve'))return fail('Forbidden',403);const b=await req.json();
 const applicationId=String(b.applicationId||''),scheduledAt=new Date(b.scheduledAt),location=String(b.location||'').trim(),interviewer=String(b.interviewer||'').trim(),mode=String(b.mode||'');
 if(!applicationId||!Number.isFinite(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()-60000||location.length<2||location.length>250||interviewer.length<2||interviewer.length>160||!['IN_PERSON','VIDEO','PHONE'].includes(mode))return fail('Invalid interview details',400);
 const app=await db.recruitmentApplication.findFirst({where:{id:applicationId,status:'INTERVIEW',...scoped(a)}});if(!app)return fail('Interview-selected application not found in scope',404);
 const existing=await db.recruitmentInterview.findUnique({where:{applicationId}});if(existing)return fail('An interview already exists for this application',409);
 const result=await db.$transaction(async tx=>{const interview=await tx.recruitmentInterview.create({data:{applicationId,scheduledAt,location,interviewer,mode,createdById:a.user!.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_INTERVIEW_SCHEDULED',entity:'RecruitmentInterview',entityId:interview.id,detail:{applicationId}}});return interview});return ok({interview:result},201);
 }catch(e){console.error('Recruitment interviews POST',e);return fail('Unable to schedule interview',500)}}
