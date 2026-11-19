import {db} from './db';
import {balance} from './leave';
import type {access} from './auth';
type Actor=Awaited<ReturnType<typeof access>>;
export type HrIntent='balance'|'status'|'submit'|'navigation'|'sensitive_payroll'|null;
export function detectHrIntent(question:string):HrIntent{
 const q=question.toLowerCase().replace(/[’]/g,"'");
 // Sensitive payroll requests are routed locally before policy retrieval or an AI call.
 // No payroll figures, payslip contents, bank details, or company payroll rows
 // are queried or included in the language-model context.
 // Match ordinary language as well as payroll terminology, without reading payroll data.
 // Personal questions and requests for another person's records are routed before
 // policy retrieval, so the LLM never invents an individual pay amount.
 const payrollTopic=/\b(?:salary|salaries|salaried|wages?|payroll|pay\s*checks?|pay\s*slips?|payslips?|paychecks?|paydays?|pay\s*days?|paid|payment\s+(?:history|status|date)|earnings?|gross\s+(?:pay|salary|earnings?)|net\s+(?:pay|salary|earnings?)|take[ -]?home\s+pay|basic\s+(?:pay|salary)|compensation|remuneration|allowances?|bonuses?|deductions?|paye|ssnit|pension\s+contributions?|bank\s+(?:account|details)|account\s+number)\b/i.test(q);
 const personalOrRecords=/\b(?:my|mine|me|i|i'm|i am|am i|do i|did i|our|we|you|employee|employees|staff|everyone|everybody|all|anyone|someone|another|other|colleague|coworker|branch|department|company|list|show|view|see|check|find|retrieve|access|download|print|open|amount|details|records|report|how much|what is|what's|who earns|highest|lowest|when will|when was|how do i|where can i)\b/i.test(q);
 const clearlyGeneral=/\b(?:policy|policies|rules|procedure|statutory|minimum wage|legal requirement|law|how (?:is|are) .* calculated|what are .* requirements|tax rates?|pension rates?)\b/i.test(q)
   && !/\b(?:my|mine|me|i|i'm|i am|am i|our|we|someone|another|colleague|everyone|all salaries|staff salaries|employee records|personal|pay\s*slip|payslip|pay\s*check|paycheck|bank details)\b/i.test(q);
 if(payrollTopic&&personalOrRecords&&!clearlyGeneral)return 'sensitive_payroll';
 // A bare personal pay question can omit 'salary', e.g. 'how much am I being paid?'
 if(/\b(?:how much|when|have|was|am|were|did)\b.*\b(?:i|me|my)\b.*\bpaid\b|\b(?:am i|was i|have i|did i)\s+(?:being\s+)?paid\b|\b(?:my|mine)\s+pay\b/i.test(q)&&!clearlyGeneral)return 'sensitive_payroll';
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
 if(intent==='sensitive_payroll'){
  // Do not read the payroll tables here. Access control and any additional
  // verification must happen in the destination HRMS module, not in the LLM.
  return /\b(?:other|another|someone|anyone|everyone|everybody|all|colleague|coworker|staff|employees|highest|lowest|company.wide)\b/i.test(question) && !/\b(?:my|mine|me)\b/i.test(question) ? 'I cannot provide another employee’s confidential payroll information. Access to payroll records is restricted to authorized HRMS users.' : 'Your salary, paycheck, earnings, deductions, payslips and payment history are confidential. Nex HR does not read or display these amounts in chat. To view your own finalized payslips, deductions or confirmed payments, open Employee Self-Service → My Payslips: /self-service?tab=payslips. Access is controlled by your authenticated HRMS account. For missing records, contact HR or Payroll.';
 }
 if(intent==='navigation'){
  if(/payslip|pay slip/i.test(question))return 'Open Employee Self-Service → My Payslips to view your own authorized payslips: /self-service?tab=payslips';
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
