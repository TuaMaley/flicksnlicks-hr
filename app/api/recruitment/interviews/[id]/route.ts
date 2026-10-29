import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.approve'))return fail('Forbidden',403);const {id}=await ctx.params;const b=await req.json();
 if(!['COMPLETED','CANCELLED'].includes(b.status))return fail('Invalid interview status',400);
 const interview=await db.recruitmentInterview.findFirst({where:{id,application:{vacancy:{branch:{employees:{some:employeeWhere(a)}}}}}});if(!interview)return fail('Interview not found',404);
 if(interview.status!=='SCHEDULED')return fail('Only scheduled interviews can be completed or cancelled',409);
 const updated=await db.$transaction(async tx=>{const changed=await tx.recruitmentInterview.updateMany({where:{id,status:'SCHEDULED'},data:{status:b.status}});if(!changed.count)return null;await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_INTERVIEW_STATUS',entity:'RecruitmentInterview',entityId:id,detail:{status:b.status}}});return tx.recruitmentInterview.findUnique({where:{id}})});if(!updated)return fail('Interview changed; refresh',409);return ok({interview:updated});
 }catch(e){console.error('Recruitment interview PATCH',e);return fail('Unable to update interview',500)}}
