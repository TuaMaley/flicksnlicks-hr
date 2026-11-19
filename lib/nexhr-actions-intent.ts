import {db} from './db';
import {balance} from './leave';
import type {access} from './auth';
type Actor=Awaited<ReturnType<typeof access>>;
export type HrIntent='balance'|'status'|'submit'|'navigation'|null;
export function detectHrIntent(question:string):HrIntent{
 const q=question.toLowerCase().replace(/[’]/g,"'");
 // A general policy question must stay in the policy knowledge flow.
 if(/\b(policy|entitlement|entitled|eligible|eligibility|rules|procedure|how many days (?:are|is) (?:employees|staff)|how much leave (?:do employees|does an employee))\b/.test(q)&&! /\b(my|mine|i have|i've|i want|i need|for me)\b/.test(q))return null;
 if(/\b(payslip|pay slip|performance appraisal|self.service)\b/.test(q)&&/\b(where|open|view|access|find|show|how)\b/.test(q))return 'navigation';
 if(!/\b(leave|vacation|time off|holiday request)\b/.test(q))return null;
 if(/\b(apply|submit|request|book|take)\b/.test(q)&&/\b(i want|i need|can i|how do i|please|for me|my)\b/.test(q)&&!/\b(status|pending|approved|rejected|last|recent|previous)\b/.test(q))return 'submit';
 if(/\b(status|pending|approved|rejected|last|latest|recent|track|history|application|applications|requests)\b/.test(q)&&/\b(my|mine|i submitted|i applied|i requested|for me)\b/.test(q))return 'status';
 if(/\b(balance|remaining|left|available|used|taken|how many|how much)\b/.test(q)&&/\b(my|mine|i have|i've|for me)\b/.test(q))return 'balance';
 return null;
}
export async function employeeHrAnswer(a:Actor,question:string,intent:Exclude<HrIntent,null>):Promise<string>{
 if(intent==='navigation'){
  if(/payslip|pay slip/i.test(question))return 'Open Payroll to view your payslip, subject to your payroll permissions: /payroll';
  if(/appraisal|performance/i.test(question))return 'Open Performance to view your appraisal, subject to your permissions: /performance';
  return 'Open Employee Self-Service: /self-service';
 }
 if(!a.companyId||!a.user?.employeeId)return 'Your account is not linked to an employee profile in the selected company. Please contact HR to link your employee record.';
 const employeeId=a.user.employeeId;
 const employee=await db.employee.findFirst({where:{id:employeeId,companyId:a.companyId},select:{id:true}});
 if(!employee)return 'Your employee profile is not available in the selected company. Please contact HR.';
 const canView=a.can('leave.view')||a.can('leave.create')||a.can('selfservice.view')||a.can('selfservice.edit');
 if(!canView)return 'You do not have permission to view your personal leave records. Please contact HR.';
 if(intent==='submit')return 'To submit a leave request, expand HR Actions above, select the leave type and dates, then review and confirm the request. Submission is not approval.';
 const year=new Date().getUTCFullYear();
 if(intent==='status'){
  const rows=await db.leaveRequest.findMany({where:{companyId:a.companyId,employeeId},orderBy:{createdAt:'desc'},take:5,select:{type:true,status:true,startDate:true,endDate:true,days:true}});
  if(!rows.length)return 'You have no leave requests recorded in this company. Open HR Actions to submit one.';
  const latestOnly=/\b(last|latest|most recent)\b/i.test(question);
  return (latestOnly?'Your latest leave request:':'Your recent leave requests:')+'\n'+(latestOnly?rows.slice(0,1):rows).map(r=>`${r.type}: ${r.status} — ${r.days} day(s), ${r.startDate.toISOString().slice(0,10)} to ${r.endDate.toISOString().slice(0,10)}`).join('\n');
 }
 const type=/\b(sick)\b/i.test(question)?'SICK':/\b(maternity)\b/i.test(question)?'MATERNITY':/\b(paternity)\b/i.test(question)?'PATERNITY':/\b(compassionate)\b/i.test(question)?'COMPASSIONATE':'ANNUAL';
 const b=await balance(employeeId,type,year,a.companyId);
 const pending=await db.leaveRequest.aggregate({where:{companyId:a.companyId,employeeId,type,status:'PENDING',startDate:{gte:new Date(`${year}-01-01T00:00:00Z`),lt:new Date(`${year+1}-01-01T00:00:00Z`)}},_sum:{days:true}});
 const reserved=pending._sum.days||0;
 return `Your ${type.toLowerCase()} leave balance for ${year} is ${b.remaining} day(s) remaining (${b.entitled} entitled, ${b.used} approved/used). ${reserved} day(s) are in pending requests; ${b.remaining-reserved} day(s) remain after pending requests. These figures come from your HRMS leave records, not the general policy. If the entitlement looks incorrect, ask HR to check your leave allocation.`;
}
