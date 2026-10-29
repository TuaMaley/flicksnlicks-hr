import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
export async function POST(req:NextRequest){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.approve'))return fail('Forbidden',403);const b=await req.json();const interviewId=String(b.interviewId||''),recommendation=String(b.recommendation||''),comments=String(b.comments||'').trim();
 const fields=['communication','technical','experience','cultureFit','professionalism'] as const;
 if(!interviewId||!['STRONG_YES','YES','MAYBE','NO'].includes(recommendation)||comments.length>2000||fields.some(k=>!Number.isInteger(b[k])||b[k]<1||b[k]>5))return fail('All five scores must be 1–5, with a valid recommendation',400);
 const interview=await db.recruitmentInterview.findFirst({where:{id:interviewId,status:'COMPLETED',application:{vacancy:{branch:{employees:{some:employeeWhere(a)}}}}}});if(!interview)return fail('Completed interview not found in scope',404);
 const existing=await db.recruitmentAssessment.findUnique({where:{interviewId_reviewerId:{interviewId,reviewerId:a.user.id}}});if(existing)return fail('You have already submitted an assessment for this interview',409);
 const assessment=await db.$transaction(async tx=>{const result=await tx.recruitmentAssessment.create({data:{interviewId,reviewerId:a.user!.id,reviewerName:a.user!.name||a.user!.email,communication:b.communication,technical:b.technical,experience:b.experience,cultureFit:b.cultureFit,professionalism:b.professionalism,recommendation,comments}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_ASSESSMENT_SUBMITTED',entity:'RecruitmentAssessment',entityId:result.id,detail:{interviewId,recommendation}}});return result});return ok({assessment},201);
 }catch(e){console.error('Recruitment assessment POST',e);return fail('Unable to save assessment',500)}}
