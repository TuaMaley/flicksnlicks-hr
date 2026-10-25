import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
export async function GET(){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.view'))return fail('Forbidden',403);
 const allowed=await db.employee.findMany({where:employeeWhere(a),select:{id:true}});
 const ids=allowed.map(x=>x.id);
 const cycles=await db.appraisalCycle.findMany({where:{OR:[{createdBy:a.user.id},{assignments:{some:{employeeId:{in:ids}}}}]},include:{assignments:{where:{employeeId:{in:ids}},select:{id:true,employeeId:true,templateId:true,reviewId:true,status:true,selfCompletedAt:true,managerCompletedAt:true,completedAt:true}}},orderBy:{createdAt:'desc'},take:100});
 const reviewIds=cycles.flatMap(c=>c.assignments.map(x=>x.reviewId).filter((x):x is string=>Boolean(x)));
 const reviews=await db.appraisalReview.findMany({where:{id:{in:reviewIds}},select:{id:true,status:true,selfScores:true,managerScores:true,approvedAt:true}});
 const byId=new Map(reviews.map(r=>[r.id,r]));
 const result=cycles.map(c=>({...c,assignments:c.assignments.map(x=>{const r=x.reviewId?byId.get(x.reviewId):null;return {...x,status:r?.status||x.status,selfCompletedAt:r?.selfScores?c.startDate:null,managerCompletedAt:r?.managerScores?c.startDate:null,completedAt:r?.approvedAt||null}})}));
 return ok({cycles:result});
}
export async function POST(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.create'))return fail('Forbidden',403);
 const d=await req.json().catch(()=>null);
 if(!d||typeof d.name!=='string'||d.name.trim().length<3||d.name.length>120||typeof d.period!=='string'||!/^\d{4}-(Q[1-4]|H[12]|ANNUAL)$/.test(d.period))return fail('Invalid name or period');
 const dates=['startDate','selfDeadline','managerDeadline','endDate'].map(k=>new Date(d[k]));
 if(dates.some(x=>Number.isNaN(x.getTime()))||!(dates[0]<=dates[1]&&dates[1]<=dates[2]&&dates[2]<=dates[3]))return fail('Dates must follow start, self-assessment, manager assessment, end order');
 const cycle=await db.appraisalCycle.create({data:{name:d.name.trim(),period:d.period,startDate:dates[0],selfDeadline:dates[1],managerDeadline:dates[2],endDate:dates[3],createdBy:a.user.id}});
 await db.auditLog.create({data:{actorId:a.user.id,action:'APPRAISAL_CYCLE_CREATE',entity:'AppraisalCycle',entityId:cycle.id}});
 return ok({cycle},201);
}
