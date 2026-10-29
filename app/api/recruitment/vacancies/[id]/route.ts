import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {access,employeeWhere} from '../../../../../../lib/auth';
import {fail,ok} from '../../../../../../lib/http';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.approve'))return fail('Forbidden',403);const {id}=await ctx.params;const b=await req.json();if(!['PUBLISHED','ON_HOLD','CLOSED'].includes(b.status))return fail('Invalid vacancy status',400);
const v=await db.recruitmentVacancy.findFirst({where:{id,branch:{employees:{some:employeeWhere(a)}}}});if(!v)return fail('Vacancy not found',404);
if(!({DRAFT:['PUBLISHED','CLOSED'],PUBLISHED:['ON_HOLD','CLOSED'],ON_HOLD:['PUBLISHED','CLOSED'],CLOSED:[]} as Record<string,string[]>)[v.status]?.includes(b.status))return fail('Invalid status transition',409);
const result=await db.$transaction(async tx=>{const updated=await tx.recruitmentVacancy.updateMany({where:{id,status:v.status},data:{status:b.status}});if(!updated.count)return null;await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_VACANCY_STATUS',entity:'RecruitmentVacancy',entityId:id,detail:{from:v.status,to:b.status}}});return tx.recruitmentVacancy.findUnique({where:{id}})});if(!result)return fail('Vacancy changed; refresh',409);return ok({vacancy:result});}catch(e){console.error('Vacancy status PATCH',e);return fail('Unable to update vacancy',500)}}
