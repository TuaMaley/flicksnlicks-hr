import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export async function GET(){
 try{
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
 if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});
 if(!a.user.employeeId)return NextResponse.json({error:'Your account is not linked to an employee record'},{status:403});
 const enrollments=await db.trainingEnrollment.findMany({
 where:{employeeId:a.user.employeeId},
 select:{id:true,status:true,enrolledAt:true,training:{select:{id:true,title:true,code:true,category:true,description:true,status:true,startDate:true,endDate:true,durationHours:true,location:true,trainer:true}},attendance:{select:{status:true,session:{select:{sessionDate:true}}}},evaluations:{select:{submittedAt:true}}},
 orderBy:{enrolledAt:'desc'},take:100});
 return NextResponse.json({enrollments},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('ESS training',e);return NextResponse.json({error:'Unable to load training'},{status:500})}
}
