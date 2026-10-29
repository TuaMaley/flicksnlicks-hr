import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
const scopeWhere=(a:Awaited<ReturnType<typeof access>>)=>({employees:{some:employeeWhere(a)}});
export async function POST(req:NextRequest){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.create'))return fail('Forbidden',403);const b=await req.json();
 const firstName=String(b.firstName||'').trim(),lastName=String(b.lastName||'').trim(),email=String(b.email||'').trim().toLowerCase(),phone=String(b.phone||'').trim(),qualification=String(b.qualification||'').trim(),experience=String(b.experience||'').trim();
 if(!firstName||firstName.length>100||!lastName||lastName.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||phone.length>50||qualification.length>500||experience.length>2000||typeof b.vacancyId!=='string')return fail('Invalid candidate details',400);
 const vacancy=await db.recruitmentVacancy.findFirst({where:{id:b.vacancyId,status:'PUBLISHED',branch:scopeWhere(a)}});if(!vacancy)return fail('Published vacancy not found in scope',404);
 const result=await db.$transaction(async tx=>{let candidate=await tx.recruitmentCandidate.findUnique({where:{email}});if(!candidate)candidate=await tx.recruitmentCandidate.create({data:{firstName,lastName,email,phone,qualification,experience}});
 const prior=await tx.recruitmentApplication.findUnique({where:{vacancyId_candidateId:{vacancyId:vacancy.id,candidateId:candidate.id}}});if(prior)return null;
 const app=await tx.recruitmentApplication.create({data:{vacancyId:vacancy.id,candidateId:candidate.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_APPLICATION_CREATED',entity:'RecruitmentApplication',entityId:app.id,detail:{vacancyId:vacancy.id}}});return app});if(!result)return fail('Candidate has already applied for this vacancy',409);return ok({application:result},201);
 }catch(e){console.error('Recruitment application POST',e);return fail('Unable to register application',500)}}
