import {NextRequest} from 'next/server';import {db} from '../../../../../lib/db';import {access} from '../../../../../lib/auth';import {fail,ok} from '../../../../../lib/http';
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.user.roles.some(r=>r.role.active&&r.role.name==='Administrator'))return fail('Administrator required',403);const {id}=await params;const d=await req.json().catch(()=>null);const reason=typeof d?.reason==='string'?d.reason.trim():'';if(reason.length<10)return fail('Deletion reason must be at least 10 characters');const row=await db.appraisalTemplate.findUnique({where:{id}});if(!row||row.deletedAt)return fail('Template not found',404);await db.$transaction([db.appraisalTemplate.update({where:{id},data:{active:false,deletedAt:new Date(),deletedReason:reason}}),db.auditLog.create({data:{actorId:a.user.id,action:'APPRAISAL_TEMPLATE_DELETE',entity:'AppraisalTemplate',entityId:id,detail:{reason,name:row.name}}})]);return ok({success:true});}


// Editing a template that already has reviews would change historical KPI scorecards.
// Require a new template version instead, preserving the original evaluation criteria.
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('appraisals.edit')||!a.user.roles.some(r=>r.role.active&&['Administrator','HR Manager'].includes(r.role.name)))return fail('HR Manager or Administrator required',403);
 const {id}=await params;
 const body=await req.json().catch(()=>null);
 if(!body||!Array.isArray(body.criteria))return fail('Invalid KPI payload',400);
 const criteria=body.criteria;
 if(criteria.length<1||criteria.length>20)return fail('A template requires 1–20 KPIs',400);
 const names=new Set<string>();let sum=0;
 for(const c of criteria){
  if(!c||typeof c.name!=='string'||c.name.trim().length<2||c.name.trim().length>120||!Number.isInteger(c.weight)||c.weight<1||c.weight>100)return fail('Each KPI requires a name (2–120 characters) and an integer weight (1–100)',400);
  const normalized=c.name.trim().toLowerCase();if(names.has(normalized))return fail('Duplicate KPI names are not allowed',400);
  names.add(normalized);sum+=c.weight;
 }
 if(sum!==100)return fail('KPI weights must total exactly 100%',400);
 const existing=await db.appraisalTemplate.findUnique({where:{id},select:{id:true,name:true,deletedAt:true,active:true,_count:{select:{reviews:true}}}});
 if(!existing||existing.deletedAt)return fail('Template not found',404);
 if(!existing.active)return fail('Inactive templates cannot be edited',409);
 if(existing._count.reviews>0)return fail('This template already has appraisal reviews. Create a new template version to preserve historical KPI scores.',409);
 const cleaned=criteria.map((c:{name:string;weight:number})=>({name:c.name.trim(),weight:c.weight}));
 const [template]=await db.$transaction([
  db.appraisalTemplate.update({where:{id},data:{criteria:cleaned}}),
  db.auditLog.create({data:{actorId:a.user.id,action:'APPRAISAL_TEMPLATE_KPI_UPDATE',entity:'AppraisalTemplate',entityId:id,detail:{templateName:existing.name,criteria:cleaned}}})
 ]);
 return ok({template});
}
