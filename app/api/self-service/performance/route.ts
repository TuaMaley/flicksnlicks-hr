import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';

export async function GET(){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});
  if(!a.user.employeeId)return NextResponse.json({error:'Your account is not linked to an employee record. Contact HR.'},{status:403});
  const employeeId=a.user.employeeId;
  const [reviews,cycles]=await Promise.all([
   db.appraisalReview.findMany({where:{employeeId},select:{id:true,period:true,status:true,score:true,selfComment:true,managerComment:true,approvedAt:true,template:{select:{name:true,category:true,level:true}}},orderBy:{createdAt:'desc'},take:60}),
   db.appraisalCycleAssignment.findMany({where:{employeeId},select:{id:true,status:true,selfCompletedAt:true,managerCompletedAt:true,cycle:{select:{name:true,period:true,endDate:true}}},orderBy:{createdAt:'desc'},take:60})
  ]);
  // Keep draft and in-review manager feedback private until HR approval.
  const safe=reviews.map(r=>{
   const approved=r.approvedAt!==null;
   return {...r,score:approved?r.score:null,managerComment:approved?r.managerComment:null};
  });
  return NextResponse.json({reviews:safe,cycles},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('ESS performance',e);return NextResponse.json({error:'Unable to load performance history'},{status:500})}
}
