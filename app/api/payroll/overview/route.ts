import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
export async function GET(){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 if(!a.companyId)return fail('Company selection required',403);
 if(!a.can('payroll.view'))return fail('Payroll access required',403);
 const scoped=employeeWhere(a);
 const [employees,runs,byBranch]=await Promise.all([
  db.employee.count({where:{AND:[scoped,{status:'ACTIVE'}]}}),
  db.payrollRun.findMany({where:{companyId:a.companyId},orderBy:{period:'desc'},take:12,select:{id:true,period:true,status:true,grossAmount:true,netAmount:true,createdAt:true}}),
  db.employee.groupBy({by:['branchId'],where:{AND:[scoped,{status:'ACTIVE'}]},_count:{_all:true}})
 ]);
 const branches=await db.branch.findMany({where:{companyId:a.companyId,id:{in:byBranch.map(b=>b.branchId)}},select:{id:true,name:true}});
 const names=new Map(branches.map(b=>[b.id,b.name]));
 const latest=runs[0]||null;
 // PayrollRun has no branch or employee links in the current schema. Show company-wide payroll
 // totals ONLY for users with global reporting scope, never misrepresent them as branch scoped.
 const global=a.user.roles.some(r=>r.role.active&&['Administrator','HR Manager'].includes(r.role.name));
 return ok({activeEmployees:employees,branches:byBranch.map(b=>({name:names.get(b.branchId)||'Unknown',count:b._count._all})).sort((a,b)=>b.count-a.count),
  latest:global&&latest?{period:latest.period,status:latest.status,gross:Number(latest.grossAmount),net:Number(latest.netAmount)}:null,
  runs:global?runs.map(r=>({id:r.id,period:r.period,status:r.status,gross:Number(r.grossAmount),net:Number(r.netAmount)})):[],
  pending:global?runs.filter(r=>r.status==='PENDING_APPROVAL').length:null,
  payrollTotalsRestricted:!global});
}
