import {access,employeeWhere} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export async function compensationAccess(){
 const a=await access();
 const hr=Boolean(a.user?.roles.some(r=>r.role.active&&['Administrator','HR Manager'].includes(r.role.name)));
 const canView=hr||a.can('employees.salary.view');
 const canEdit=hr&&a.can('employees.edit');
 const canApprove=Boolean(a.user?.roles.some(r=>r.role.active&&r.role.name==='Administrator'))&&a.can('employees.salary.view');
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
