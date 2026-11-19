import {db} from './db';
import type {access} from './auth';

type Actor=Awaited<ReturnType<typeof access>>;
export type PersonalProfileIntent='branch'|'department'|'position'|'employment_type'|'manager'|'profile';

/** Only explicit questions about the signed-in user's non-payroll work profile. */
export function detectPersonalProfileIntent(input:string):PersonalProfileIntent|null{
 const q=input.toLowerCase().replace(/[’]/g,"'").trim();
 // Never route compensation, bank details, payslips or other sensitive questions into profile retrieval.
 if(/\b(salary|salaries|pay|payroll|payslip|bank|account|tax|ssnit|pension|medical|health|national id|ghana card|address|phone|email)\b/.test(q))return null;
 if(!/\b(my|mine|i am|i'm|do i|am i|who is my|where do i)\b/.test(q))return null;
 if(/\b(branch|work location|which location)\b/.test(q))return 'branch';
 if(/\b(department|team)\b/.test(q))return 'department';
 if(/\b(position|job title|job role|designation)\b/.test(q))return 'position';
 if(/\b(employment type|employment category|full.time|part.time|contract type)\b/.test(q))return 'employment_type';
 if(/\b(manager|supervisor|report to|reporting line)\b/.test(q))return 'manager';
 if(/\b(employee profile|work profile|employment details|my details)\b/.test(q))return 'profile';
 return null;
}

export async function answerPersonalProfileQuestion(a:Actor,intent:PersonalProfileIntent):Promise<string>{
 if(!a.companyId||!a.user?.employeeId)return 'Your account is not linked to an employee profile in this company. Please contact HR.';
 if(!(a.can('selfservice.view')||a.can('selfservice.edit')||a.can('employees.view')||a.can('leave.view')))
  return 'You do not have permission to view your employee profile. Please contact HR.';
 // Never accept a user-supplied employee ID or company ID. Use the signed-in user's linked record.
 const employee=await db.employee.findFirst({
  where:{id:a.user.employeeId,companyId:a.companyId},
  select:{firstName:true,lastName:true,position:true,department:true,employmentType:true,
   branch:{select:{name:true,companyId:true}},
   reportingManager:{select:{firstName:true,lastName:true,companyId:true}}}
 });
 if(!employee)return 'Your employee profile was not found in the selected company. Please contact HR.';
 const branch=employee.branch?.companyId===a.companyId?employee.branch.name:null;
 const manager=employee.reportingManager?.companyId===a.companyId
  ?`${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`:null;
 const known=(s:string|null|undefined)=>s?.trim()||'Not recorded in your HRMS profile';
 switch(intent){
  case 'branch':return `Your assigned branch is ${known(branch)}.`;
  case 'department':return `Your department is ${known(employee.department)}.`;
  case 'position':return `Your position is ${known(employee.position)}.`;
  case 'employment_type':return `Your employment type is ${known(employee.employmentType?.replace(/_/g,' ').toLowerCase())}.`;
  case 'manager':return `Your reporting manager is ${known(manager)}.`;
  case 'profile':return `Your HRMS work profile:\nName: ${employee.firstName} ${employee.lastName}\nBranch: ${known(branch)}\nDepartment: ${known(employee.department)}\nPosition: ${known(employee.position)}\nEmployment type: ${known(employee.employmentType?.replace(/_/g,' ').toLowerCase())}\nReporting manager: ${known(manager)}.\nFor changes, contact HR.`;
 }
}
