import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {access} from '../../../../../../lib/auth';
import {fail,ok} from '../../../../../../lib/http';

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 if(!a.can('appraisals.create'))return fail('Forbidden',403);
 const {id}=await params;
 const body=await req.json().catch(()=>null);
 if(!body||typeof body.name!=='string')return fail('New template name is required',400);
 const name=body.name.trim();
 if(name.length<3||name.length>120)return fail('Template name must be 3–120 characters',400);
 const original=await db.appraisalTemplate.findUnique({where:{id}});
 if(!original||original.deletedAt)return fail('Original template not found',404);
 if(!original.active)return fail('Inactive templates cannot be duplicated',409);
 if(original.name.toLowerCase()===name.toLowerCase())return fail('Use a different name for the new version',400);
 try{
  const copy=await db.$transaction(async tx=>{
   const created=await tx.appraisalTemplate.create({data:{name,category:original.category,level:original.level,description:original.description,criteria:original.criteria as any,active:true}});
   await tx.auditLog.create({data:{actorId:a.user!.id,action:'APPRAISAL_TEMPLATE_DUPLICATE',entity:'AppraisalTemplate',entityId:created.id,detail:{sourceTemplateId:original.id,sourceTemplateName:original.name,newTemplateName:name}}});
   return created;
  });
  return ok({template:copy},201);
 }catch(e){
  if(e&&typeof e==='object'&&'code'in e&&(e as {code?:string}).code==='P2002')return fail('A template with that name already exists',409);
  console.error('Appraisal template duplication failed',e);
  return fail('Unable to duplicate template',500);
 }
}
