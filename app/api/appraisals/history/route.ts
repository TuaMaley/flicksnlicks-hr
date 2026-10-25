import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

export async function GET(req:NextRequest){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 if(!a.can('appraisals.view'))return fail('Forbidden',403);
 const requested=req.nextUrl.searchParams.get('employeeId')?.trim()||'';
 if(requested.length>100)return fail('Invalid employee ID',400);
 const scope=employeeWhere(a);
 const isOwn=Boolean(a.user.employeeId&&requested===a.user.employeeId);
 const isHR=a.user.roles.some(r=>r.role.active&&(r.role.name==='HR Manager'||r.role.name==='Administrator'));
 // No employeeId: default to the current user's own history, if available.
 // HR and authorized managers can choose another employee only inside employeeWhere scope.
 const employeeId=requested||a.user.employeeId||'';
 if(!employeeId)return ok({employee:null,reviews:[],employees:[],summary:null});
 const employee=await db.employee.findFirst({where:{AND:[{id:employeeId},scope]},select:{id:true,employeeNo:true,firstName:true,lastName:true,position:true,department:true,branch:{select:{name:true}}}});
 if(!employee)return fail('Employee not found in your authorized scope',403);
 const reviews=await db.appraisalReview.findMany({where:{employeeId:employee.id},select:{id:true,period:true,status:true,score:true,selfScores:true,managerScores:true,selfComment:true,managerComment:true,createdAt:true,updatedAt:true,approvedAt:true,template:{select:{name:true,criteria:true}}},orderBy:[{createdAt:'desc'}],take:200});
 const completed=reviews.filter(r=>r.status==='FINALIZED'||r.status==='APPROVED');
 const scored=completed.filter(r=>r.score!==null);
 const average=scored.length?Number((scored.reduce((sum,r)=>sum+(r.score||0),0)/scored.length).toFixed(2)):null;
 // Only reveal the employee selector to HR or scoped managers, not ordinary staff.
 const canBrowse=isHR||a.can('appraisals.approve')||a.can('appraisals.edit');
 let employees:{id:string;firstName:string;lastName:string;employeeNo:string}[]=[];
 if(canBrowse){
  employees=await db.employee.findMany({where:scope,select:{id:true,firstName:true,lastName:true,employeeNo:true},orderBy:[{firstName:'asc'},{lastName:'asc'}],take:1000});
 }
 // Draft and manager-only ratings remain accessible to the employee only for their own record;
 // manager comments and scores are disclosed to employees only after final approval.
 const safeReviews=reviews.map(r=>{
  const canSeeManagerDetails=!isOwn||r.status==='FINALIZED'||r.status==='APPROVED';
  return {...r,managerScores:canSeeManagerDetails?r.managerScores:null,managerComment:canSeeManagerDetails?r.managerComment:null,score:canSeeManagerDetails?r.score:null};
 });
 return ok({employee,reviews:safeReviews,employees,summary:{total:reviews.length,completed:completed.length,averageScore:average,latestCompletedPeriod:completed[0]?.period||null},truncated:reviews.length===200,employeeListTruncated:employees.length===1000});
}
