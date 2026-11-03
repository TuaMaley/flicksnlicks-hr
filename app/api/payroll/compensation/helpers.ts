import {access,employeeWhere} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export async function compensationAccess(){
 const a=await access();
 // Never authorize company payroll from legacy global role names.
 // Every permission is resolved from the active company's membership.
 const tenant=Boolean(a.user && a.companyId);
 const canView=tenant && a.can('employees.salary.view');
 const canEdit=tenant && a.can('employees.salary.view') && a.can('employees.edit');
 const canApprove=tenant && a.can('employees.salary.view') && a.can('payroll.approve');
 return {a,canView,canEdit,canApprove};
}
export function moneyParts(value:unknown){
 if(!Array.isArray(value)||value.length>30)throw Error('Invalid compensation items');
 return value.map((item:any)=>{
  if(!item||typeof item.label!=='string'||!item.label.trim()||item.label.length>90||typeof item.amount!=='number'||!Number.isFinite(item.amount)||item.amount<0||item.amount>1e9)throw Error('Invalid compensation item');
  return {label:item.label.trim(),amount:Math.round(item.amount*100)/100};
 });
}
export const scopedEmployee=employeeWhere;
export {db};
