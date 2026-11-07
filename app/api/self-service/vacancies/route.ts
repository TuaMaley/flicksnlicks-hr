import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
/**
 * Internal job board for employees (self-service, read-only).
 * Lists PUBLISHED recruitment vacancies across every branch of the employee's company —
 * no recruitment.* permission needed, only selfservice.view. Draft, on-hold and closed vacancies are never exposed.
 */
export async function GET(){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company context required'},{status:403});
 if(!a.can('selfservice.view'))return NextResponse.json({error:'Permission denied'},{status:403});
 const rows=await db.recruitmentVacancy.findMany({
  where:{status:'PUBLISHED',OR:[{companyId:a.companyId},{companyId:null,requisition:{companyId:a.companyId}}]},
  orderBy:{createdAt:'desc'},take:100,
  select:{id:true,title:true,description:true,createdAt:true,updatedAt:true,branch:{select:{id:true,name:true}},requisition:{select:{department:true,employmentType:true,positions:true}}},
 });
 const vacancies=rows.map(v=>({id:v.id,title:v.title,description:v.description,postedAt:v.createdAt,updatedAt:v.updatedAt,branch:v.branch,department:v.requisition.department,employmentType:v.requisition.employmentType,positions:v.requisition.positions}));
 return NextResponse.json({vacancies});
}
