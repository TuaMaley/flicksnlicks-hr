import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';
const scopeWhere=(a:Awaited<ReturnType<typeof access>>)=>({employees:{some:employeeWhere(a)}});
export async function GET(){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.view'))return fail('Forbidden',403);
 const branchIds=(await db.branch.findMany({where:scopeWhere(a),select:{id:true}})).map(x=>x.id);
 const [vacancies,candidates,applications,approved]=await Promise.all([
 db.recruitmentVacancy.findMany({where:{branchId:{in:branchIds}},include:{branch:{select:{name:true}},requisition:{select:{positions:true,status:true}}},orderBy:{createdAt:'desc'},take:300}),
 db.recruitmentCandidate.findMany({where:{applications:{some:{vacancy:{branchId:{in:branchIds}}}}},orderBy:{createdAt:'desc'},take:300}),
 db.recruitmentApplication.findMany({where:{vacancy:{branchId:{in:branchIds}}},include:{candidate:true,vacancy:{select:{title:true,branchId:true}}},orderBy:{createdAt:'desc'},take:500}),
 db.recruitmentRequisition.findMany({where:{branchId:{in:branchIds},status:'APPROVED'},select:{id:true,title:true,branchId:true,positions:true,branch:{select:{name:true}}},orderBy:{createdAt:'desc'}})]);
 return ok({vacancies,candidates,applications,approved});}catch(e){console.error('Recruitment phase2 GET',e);return fail('Unable to load recruitment pipeline',500)}}
