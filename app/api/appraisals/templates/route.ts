import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
import {DEFAULT_APPRAISAL_TEMPLATES} from '../../../../lib/appraisal-templates';
export async function GET(){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.view')&&!a.can('appraisals.create'))return fail('Forbidden',403);return ok({templates:await db.appraisalTemplate.findMany({where:{deletedAt:null},orderBy:{name:'asc'}})});}
export async function POST(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('appraisals.create'))return fail('Forbidden',403);
 const d=await req.json().catch(()=>null);if(!d||typeof d!=='object')return fail('Invalid JSON',400);
 if(d.seed===true){if(!a.user.roles.some(r=>r.role.active&&r.role.name==='Administrator'))return fail('Administrator required',403);for(const t of DEFAULT_APPRAISAL_TEMPLATES)await db.appraisalTemplate.upsert({where:{name:t.name},update:{},create:t});return ok({created:true});}
 const name=typeof d.name==='string'?d.name.trim():'';
 const category=typeof d.category==='string'?d.category.trim():'';
 const level=typeof d.level==='string'?d.level.trim():'';
 const description=typeof d.description==='string'?d.description.trim():'';
 if(name.length<3||name.length>120||!category||category.length>80||!level||level.length>80||description.length>1000)return fail('Invalid template name, category, level or description',400);
 if(!Array.isArray(d.criteria)||d.criteria.length<1||d.criteria.length>20)return fail('Template must have 1–20 KPIs',400);
 const criteria=d.criteria.map((c:unknown)=>{if(!c||typeof c!=='object')return null;const k=c as Record<string,unknown>;return {name:typeof k.name==='string'?k.name.trim():'',weight:k.weight};});
 if(criteria.some((c:any)=>!c||c.name.length<2||c.name.length>120||!Number.isInteger(c.weight)||c.weight<1||c.weight>100))return fail('Each KPI requires a name and a whole-number weight of 1–100',400);
 if(new Set(criteria.map((c:any)=>c.name.toLowerCase())).size!==criteria.length)return fail('KPI names must be unique',400);
 if(criteria.reduce((n:number,c:any)=>n+c.weight,0)!==100)return fail('KPI weights must total 100%',400);
 try{
  const row=await db.$transaction(async tx=>{const template=await tx.appraisalTemplate.create({data:{name,category,level,description,criteria}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'APPRAISAL_TEMPLATE_CREATE',entity:'AppraisalTemplate',entityId:template.id}});return template;});
  return ok({template:row},201);
 }catch(e){if(e&&typeof e==='object'&&'code'in e&&(e as {code?:string}).code==='P2002')return fail('A template with this name already exists',409);console.error('Appraisal template creation failed',e);return fail('Unable to create template',500);}
}
