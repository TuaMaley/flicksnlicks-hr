import {NextResponse} from 'next/server';
import {access,employeeWhere} from '../../../lib/auth';
import {db} from '../../../lib/db';

export const dynamic = 'force-dynamic';
export async function GET(){
 try {
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const can=(key:string)=>a.keys.has(key);
  const scoped=employeeWhere(a);
  const people=can('employees.view')?await db.employee.findMany({where:scoped,select:{id:true,status:true,department:true,branchId:true,branch:{select:{name:true}}}}):[];
  const ids=people.map(p=>p.id);
  const allowedIds=ids.length?{in:ids}:{in:['__none__']};
  const today=new Date();today.setUTCHours(0,0,0,0);
  const leave=can('leave.view')?await db.leaveRequest.findMany({where:{employeeId:allowedIds},select:{id:true,status:true,startDate:true,endDate:true,employee:{select:{firstName:true,lastName:true,branch:{select:{name:true}}}}},orderBy:{createdAt:'desc'},take:1000}):[];
  const appraisals=can('appraisals.view')?await db.appraisalReview.findMany({where:{employeeId:allowedIds},select:{status:true,score:true,createdAt:true}}):[];
  const pips=can('appraisals.view')?await db.performanceImprovementPlan.count({where:{employeeId:allowedIds,status:'ACTIVE'}}):null;
  const training=can('training.view')?await db.training.count():null;
  const openings=can('recruitment.view')?await db.jobOpening.count({where:{status:'OPEN'}}):null;
  const branches=[...new Set(people.map(p=>p.branch.name))].sort();
  const departmentMap=new Map<string,number>();
  for(const e of people)departmentMap.set(e.department||'Unassigned',(departmentMap.get(e.department||'Unassigned')||0)+1);
  const distribution=[...departmentMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));
  const pendingLeave=leave.filter(x=>x.status==='PENDING');
  const onLeave=leave.filter(x=>x.status==='APPROVED'&&x.startDate<=today&&x.endDate>=today);
  const upcoming=leave.filter(x=>x.status==='APPROVED'&&x.startDate>today).sort((a,b)=>a.startDate.getTime()-b.startDate.getTime()).slice(0,5).map(x=>({date:x.startDate.toISOString().slice(0,10),title:`${x.employee.firstName} ${x.employee.lastName} — approved leave`,detail:x.employee.branch.name}));
  const pendingAppraisals=appraisals.filter(x=>!['APPROVED','COMPLETED','REJECTED'].includes(x.status));
  const recent=leave.slice(0,5).map(x=>({title:`Leave ${x.status.toLowerCase()}`,detail:`${x.employee.firstName} ${x.employee.lastName} · ${x.employee.branch.name}`,date:x.startDate.toISOString().slice(0,10)}));
  const canPayroll=can('payroll.view')&&a.user.roles.some(r=>r.role.active&&['Administrator','HR Manager','Finance','Finance Manager'].includes(r.role.name));
  let payroll:null|{period:string;gross:number;net:number;approvedBatches:number;pendingBatches:number;recordedPaid:number}=null;
  if(canPayroll){
   const period=new Date().toISOString().slice(0,7);
   const batches=await db.payrollCalculationBatch.findMany({where:{period},orderBy:{createdAt:'desc'},select:{status:true,grossAmount:true,netBeforeStatutory:true}});
   const approved=batches.filter(x=>['FINANCE_APPROVED','APPROVED','WORKFLOW_APPROVED'].includes(x.status));
   const paid=await db.payrollPayment.aggregate({where:{period,status:'PAID'},_sum:{netAmount:true}});
   payroll={period,gross:approved.reduce((s,x)=>s+Number(x.grossAmount),0),net:approved.reduce((s,x)=>s+Number(x.netBeforeStatutory),0),approvedBatches:approved.length,pendingBatches:batches.filter(x=>!['DRAFT','REJECTED','FINANCE_APPROVED','APPROVED','WORKFLOW_APPROVED'].includes(x.status)).length,recordedPaid:Number(paid._sum.netAmount||0)};
  }
  return NextResponse.json({generatedAt:new Date().toISOString(),employeeCount:can('employees.view')?people.length:null,activeEmployees:can('employees.view')?people.filter(x=>x.status==='ACTIVE').length:null,branches,distribution,leave:can('leave.view')?{onLeave:onLeave.length,pending:pendingLeave.length}:null,appraisals:can('appraisals.view')?{pending:pendingAppraisals.length,total:appraisals.length,averageScore:(()=>{const a=appraisals.filter(x=>x.score!==null);return a.length?Math.round(a.reduce((s,x)=>s+(x.score||0),0)/a.length*100)/100:null})()})()}:null,pips,training,openings,upcoming,recent,pendingApprovals:pendingLeave.slice(0,5).map(x=>({name:`${x.employee.firstName} ${x.employee.lastName}`,detail:x.employee.branch.name,type:'Leave Request',date:x.startDate.toISOString().slice(0,10)})),payroll},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('Dashboard error',e);return NextResponse.json({error:'Dashboard data unavailable'},{status:500})}
}
