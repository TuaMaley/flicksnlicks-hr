import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export async function GET(req:Request){
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId||!a.user.employeeId||!a.can('selfservice.view'))return NextResponse.json({error:'Employee access required'},{status:403});
 const employee=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{id:true}});
 if(!employee)return NextResponse.json({error:'Employee not found'},{status:403});
 const url=new URL(req.url),search=(url.searchParams.get('search')||'').trim().slice(0,100),location=(url.searchParams.get('location')||'').trim().slice(0,100),date=url.searchParams.get('date')||'';
 const where:any={companyId:a.companyId,status:'PUBLISHED',branch:{companyId:a.companyId}};
 if(search)where.title={contains:search,mode:'insensitive'};
 if(location)where.branch.name={contains:location,mode:'insensitive'};
 if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)){const start=new Date(date+'T00:00:00Z');if(!isNaN(start.getTime()))where.createdAt={gte:start,lt:new Date(start.getTime()+86400000)}}
 const jobs=await db.recruitmentVacancy.findMany({where,include:{branch:{select:{name:true}},requisition:{select:{positions:true,employmentType:true,department:true}},applications:{select:{id:true}},},orderBy:{createdAt:'desc'},take:150});
 const userIds=[...new Set(jobs.map(j=>j.createdById))];const recruiters=await db.user.findMany({where:{id:{in:userIds}},select:{id:true,name:true}});const names=new Map(recruiters.map(u=>[u.id,u.name]));
 return NextResponse.json({jobs:jobs.map(j=>({id:j.id,jobId:'JOB-'+j.id.slice(-8).toUpperCase(),title:j.title,location:j.branch.name,datePosted:j.createdAt,recruiter:names.get(j.createdById)||'HR Department',vacancies:j.requisition.positions,description:j.description,department:j.requisition.department,employmentType:j.requisition.employmentType,applications:j.applications.length}))});
}
