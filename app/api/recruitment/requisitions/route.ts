import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

export async function GET(){
 try {const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('recruitment.view'))return fail('Forbidden',403);
 const scope=employeeWhere(a);const branches=await db.branch.findMany({where:{employees:{some:scope}},select:{id:true,name:true},orderBy:{name:'asc'}});
 const ids=branches.map(b=>b.id);
 const [requisitions,openings]=await Promise.all([
 db.recruitmentRequisition.findMany({where:{branchId:{in:ids}},include:{branch:{select:{name:true}}},orderBy:{createdAt:'desc'},take:300}),
 db.jobOpening.count({where:{branchId:{in:ids},status:'OPEN'}})]);
 return ok({requisitions,branches,openings,permissions:[...a.keys]});
 }catch(e){console.error('Recruitment requisitions GET',e);return fail('Unable to load recruitment',500)}
}
export async function POST(req:NextRequest){
 try {const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('recruitment.create'))return fail('Forbidden',403);
 const b=await req.json();const title=typeof b.title==='string'?b.title.trim():'';
 const department=typeof b.department==='string'?b.department.trim():'';
 const justification=typeof b.justification==='string'?b.justification.trim():'';
 if(!title||title.length>160||!department||department.length>120||justification.length<10||justification.length>4000||!Number.isInteger(b.positions)||b.positions<1||b.positions>100||typeof b.branchId!=='string')return fail('Invalid requisition details',400);
 const branch=await db.branch.findFirst({where:{id:b.branchId,employees:{some:employeeWhere(a)}},select:{id:true}});
 if(!branch)return fail('Branch not available in your reporting scope',403);
 const record=await db.$transaction(async tx=>{
 const r=await tx.recruitmentRequisition.create({data:{title,department,justification,branchId:branch.id,positions:b.positions,employmentType:typeof b.employmentType==='string'?b.employmentType.slice(0,50):'FULL_TIME',requestedById:a.user!.id,requestedByName:a.user!.name}});
 await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_REQUISITION_CREATED',entity:'RecruitmentRequisition',entityId:r.id,detail:{branchId:r.branchId,positions:r.positions}}});return r});
 return ok({requisition:record},201);
 }catch(e){console.error('Recruitment requisition POST',e);return fail('Unable to create requisition',500)}
}
