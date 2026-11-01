import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export async function GET(){
 try{
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
 if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});
 if(!a.user.employeeId||!a.companyId)return NextResponse.json({error:'Employee and company context required'},{status:403});
 const employee=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{id:true}});
 if(!employee)return NextResponse.json({error:'Employee does not belong to selected company'},{status:403});
 const enrollments=await db.trainingEnrollment.findMany({
 where:{employeeId:a.user.employeeId,companyId:a.companyId,training:{companyId:a.companyId}},
 select:{id:true,status:true,enrolledAt:true,training:{select:{id:true,title:true,code:true,category:true,description:true,status:true,startDate:true,endDate:true,durationHours:true,location:true,trainer:true}},attendance:{select:{status:true,session:{select:{sessionDate:true}}}},evaluations:{select:{submittedAt:true}}},
 orderBy:{enrolledAt:'desc'},take:100});
 return NextResponse.json({enrollments},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('ESS training',e);return NextResponse.json({error:'Unable to load training'},{status:500})}
}
