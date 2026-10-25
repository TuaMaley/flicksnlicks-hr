import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';

const statuses=['DRAFT','SUBMITTED','MANAGER_REVIEWED','PENDING_HR_APPROVAL','REJECTED','APPROVED','FINALIZED'];
export async function GET(req:NextRequest){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 const roles=a.user.roles.filter(r=>r.role.active).map(r=>r.role.name);
 const isHR=roles.includes('HR Manager');
 // A dedicated, revocable permission controls analytics access. Administrator does not bypass it.
 if(!a.can('appraisals.analytics.view'))return fail('Performance analytics permission required',403);
 const params=new URL(req.url).searchParams;
 const period=(params.get('period')||'').trim();
 const branchId=(params.get('branchId')||'').trim();
 const department=(params.get('department')||'').trim();
 if(period.length>40||branchId.length>100||department.length>100)return fail('Invalid filter',400);
 const where:any={employee:employeeWhere(a)};
 if(period)where.period=period;
 if(branchId)where.employee={AND:[employeeWhere(a),{branchId}]};
 if(department)where.employee={AND:[where.employee,{department}]};
 const reviews=await db.appraisalReview.findMany({where,select:{id:true,period:true,status:true,score:true,createdAt:true,updatedAt:true,employeeId:true,employee:{select:{firstName:true,lastName:true,department:true,branchId:true,branch:{select:{name:true}}}}},orderBy:{createdAt:'desc'},take:5000});
 const countByStatus=Object.fromEntries(statuses.map(s=>[s,0])) as Record<string,number>;
 for(const r of reviews)countByStatus[r.status]=(countByStatus[r.status]||0)+1;
 const completed=reviews.filter(r=>r.status==='FINALIZED'||r.status==='APPROVED');
 const rated=reviews.filter(r=>r.score!==null&&Number.isFinite(r.score));
 const average=(rows:typeof reviews)=>rows.length?Number((rows.reduce((n,r)=>n+(r.score||0),0)/rows.length).toFixed(2)):null;
 const group=(key:(r:typeof reviews[number])=>string)=>{
  const map=new Map<string,typeof reviews>();
  for(const r of reviews){const k=key(r)||'Unassigned';if(!map.has(k))map.set(k,[]);map.get(k)!.push(r)}
  return [...map.entries()].map(([name,rows])=>({name,total:rows.length,finalized:rows.filter(r=>r.status==='FINALIZED').length,pendingHR:rows.filter(r=>r.status==='PENDING_HR_APPROVAL').length,averageScore:average(rows.filter(r=>r.score!==null))})).sort((x,y)=>y.total-x.total||x.name.localeCompare(y.name));
 };
 const employeeScores=new Map<string,{employeeId:string,name:string,department:string,branch:string,scores:number[],reviews:number}>();
 for(const r of completed){if(r.score===null)continue;let e=employeeScores.get(r.employeeId);if(!e){e={employeeId:r.employeeId,name:`${r.employee.firstName} ${r.employee.lastName}`,department:r.employee.department,branch:r.employee.branch.name,scores:[],reviews:0};employeeScores.set(r.employeeId,e)}e.scores.push(r.score);e.reviews++}
 const ranking=[...employeeScores.values()].map(e=>({employeeId:e.employeeId,name:e.name,department:e.department,branch:e.branch,reviews:e.reviews,averageScore:Number((e.scores.reduce((a,b)=>a+b,0)/e.scores.length).toFixed(2))})).sort((a,b)=>b.averageScore-a.averageScore||b.reviews-a.reviews).slice(0,10);
 const periods=[...new Set(reviews.map(r=>r.period))].sort().reverse();
 const byPeriod=group(r=>r.period).sort((a,b)=>a.name.localeCompare(b.name));
 return ok({scope:isHR?'company':'assigned',filters:{period,branchId,department},total:reviews.length,countByStatus,awaitingManager:(countByStatus.SUBMITTED||0)+(countByStatus.MANAGER_REVIEWED||0)+(countByStatus.REJECTED||0),awaitingHR:countByStatus.PENDING_HR_APPROVAL||0,finalized:countByStatus.FINALIZED||0,legacyApproved:countByStatus.APPROVED||0,completionRate:reviews.length?Number((completed.length/reviews.length*100).toFixed(1)):0,averageScore:average(rated),finalizedAverage:average(completed.filter(r=>r.score!==null)),branches:group(r=>r.employee.branch.name),departments:group(r=>r.employee.department),periods,byPeriod,ranking,reviewCountLimitReached:reviews.length===5000});
}
