import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';import {access} from '../../../../lib/auth';import {fail,ok} from '../../../../lib/http';
import {DEFAULT_APPRAISAL_TEMPLATES} from '../../../../lib/appraisal-templates';
export async function GET(){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.view')&&!a.can('appraisals.create'))return fail('Forbidden',403);return ok({templates:await db.appraisalTemplate.findMany({where:{deletedAt:null},orderBy:{name:'asc'}})});}
export async function POST(req:NextRequest){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.create'))return fail('Forbidden',403);const d=await req.json().catch(()=>null);if(!d)return fail('Invalid JSON');
if(d.seed===true){if(!a.user.roles.some(r=>r.role.active&&r.role.name==='Administrator'))return fail('Administrator required',403);for(const t of DEFAULT_APPRAISAL_TEMPLATES)await db.appraisalTemplate.upsert({where:{name:t.name},update:{},create:t});return ok({created:true});}
if(typeof d.name!=='string'||d.name.trim().length<3||typeof d.category!=='string'||typeof d.level!=='string'||!Array.isArray(d.criteria)||d.criteria.length<1||d.criteria.length>20)return fail('Invalid template');
const criteria=d.criteria;if(criteria.some((c:any)=>typeof c.name!=='string'||!c.name.trim()||!Number.isInteger(c.weight)||c.weight<=0)||criteria.reduce((n:number,c:any)=>n+c.weight,0)!==100)return fail('Criteria weights must total 100');
const row=await db.appraisalTemplate.create({data:{name:d.name.trim(),category:d.category,level:d.level,description:String(d.description||''),criteria}});await db.auditLog.create({data:{actorId:a.user.id,action:'APPRAISAL_TEMPLATE_CREATE',entity:'AppraisalTemplate',entityId:row.id}});return ok({template:row},201);
}
