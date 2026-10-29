import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
const scopeWhere=(a:Awaited<ReturnType<typeof access>>)=>({employees:{some:employeeWhere(a)}});
export async function POST(req:NextRequest){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.create'))return fail('Forbidden',403);
 const b=await req.json();const description=typeof b.description==='string'?b.description.trim():'';
 if(typeof b.requisitionId!=='string'||description.length<10||description.length>5000)return fail('Select an approved requisition and provide a description (10–5000 characters)',400);
 const r=await db.recruitmentRequisition.findFirst({where:{id:b.requisitionId,status:'APPROVED',branch:scopeWhere(a)}});if(!r)return fail('Approved requisition not found in scope',404);
 const existing=await db.recruitmentVacancy.findFirst({where:{requisitionId:r.id}});if(existing)return fail('A vacancy already exists for this requisition',409);
 const result=await db.$transaction(async tx=>{const v=await tx.recruitmentVacancy.create({data:{requisitionId:r.id,branchId:r.branchId,title:r.title,description,createdById:a.user!.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_VACANCY_CREATED',entity:'RecruitmentVacancy',entityId:v.id}});return v});return ok({vacancy:result},201);
 }catch(e){console.error('Recruitment vacancy POST',e);return fail('Unable to create vacancy',500)}}
