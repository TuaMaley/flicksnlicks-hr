import {NextRequest} from 'next/server';
import {db} from '../../../lib/db';
import {access,employeeWhere} from '../../../lib/auth';
import {fail,ok} from '../../../lib/http';

const manager=(a:Awaited<ReturnType<typeof access>>)=>Boolean(a.user?.roles.some(r=>r.role.active&&['HR Manager','Administrator','Branch Manager'].includes(r.role.name)));
const hr=(a:Awaited<ReturnType<typeof access>>)=>Boolean(a.user?.roles.some(r=>r.role.active&&['HR Manager','Administrator'].includes(r.role.name)));
const validGoals=(g:unknown)=>Array.isArray(g)&&g.length>0&&g.length<=12&&g.every(x=>x&&typeof x==='object'&&typeof x.objective==='string'&&x.objective.trim().length>=5&&x.objective.length<=500&&typeof x.measure==='string'&&x.measure.trim().length>=5&&x.measure.length<=500);

export async function GET(){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('appraisals.view'))return fail('Forbidden',403);
 const plans=await db.performanceImprovementPlan.findMany({where:{employee:employeeWhere(a)},include:{employee:{select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,branch:{select:{name:true}}}},checkIns:{orderBy:{createdAt:'desc'},take:30}},orderBy:{createdAt:'desc'},take:300});
 const canManage=manager(a);
 // Employees may see their own plans, but never another employee's plan.
 return ok({plans,canManage,canClose:hr(a)});
}
export async function POST(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!manager(a)||!a.can('appraisals.edit'))return fail('Forbidden',403);
 let d:any;try{d=await req.json()}catch{return fail('Invalid JSON',400)}
 const employeeId=String(d.employeeId||'');const title=String(d.title||'').trim();const reason=String(d.reason||'').trim();
 const startDate=new Date(d.startDate);const dueDate=new Date(d.dueDate);
 if(title.length<5||title.length>160||reason.length<15||reason.length>3000||!validGoals(d.goals)||!Number.isFinite(startDate.getTime())||!Number.isFinite(dueDate.getTime())||dueDate<=startDate)return fail('Provide a title, reason (15+ characters), measurable goals, and valid start/end dates',400);
 const employee=await db.employee.findFirst({where:{AND:[{id:employeeId},employeeWhere(a)]},select:{id:true}});if(!employee)return fail('Employee outside your reporting scope',403);
 if(employeeId===a.user.employeeId)return fail('You cannot create your own PIP',403);
 const existing=await db.performanceImprovementPlan.findFirst({where:{employeeId,status:{in:['DRAFT','ACTIVE']}},select:{id:true}});if(existing)return fail('Employee already has an open improvement plan',409);
 const plan=await db.$transaction(async tx=>{const p=await tx.performanceImprovementPlan.create({data:{employeeId,title,reason,goals:d.goals,startDate,dueDate,createdById:a.user!.id,managerId:a.user!.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'PIP_CREATED',entity:'PerformanceImprovementPlan',entityId:p.id,detail:{employeeId,title}}});return p});
 return ok(plan,201);
}
