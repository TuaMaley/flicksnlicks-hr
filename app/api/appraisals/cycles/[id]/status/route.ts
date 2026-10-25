import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {access,employeeWhere} from '../../../../../../lib/auth';
import {fail,ok} from '../../../../../../lib/http';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.edit'))return fail('Forbidden',403);
 const {id}=await params;const d=await req.json().catch(()=>null);
 if(!d||!['OPEN','CLOSED'].includes(d.status))return fail('Invalid status');
 const cycle=await db.appraisalCycle.findUnique({where:{id}});if(!cycle)return fail('Cycle not found',404);
 const scoped=await db.employee.findMany({where:employeeWhere(a),select:{id:true}});
 const assigned=await db.appraisalCycleAssignment.count({where:{cycleId:id}});
 const visible=await db.appraisalCycleAssignment.count({where:{cycleId:id,employeeId:{in:scoped.map(x=>x.id)}}});
 if(assigned!==visible)return fail('You cannot manage a cycle outside your employee scope',403);
 const updated=await db.appraisalCycle.update({where:{id},data:{status:d.status}});
 await db.auditLog.create({data:{actorId:a.user.id,action:'APPRAISAL_CYCLE_STATUS',entity:'AppraisalCycle',entityId:id}});
 return ok({cycle:updated});
}
