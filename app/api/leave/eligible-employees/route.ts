import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
import {isHR} from '../../../../lib/leave';

// Leave-specific, minimal employee picker. Never exposes the general employee directory.
export async function GET(){
  const a=await access();
  if(!a.user)return fail('Unauthorized',401);
  if(!a.companyId)return fail('Company selection required',403);
  if(!a.can('leave.view')&&!a.can('leave.create'))return fail('Forbidden',403);
  const mayListScopedEmployees=isHR(a)||a.can('leave.approve');
  const where=mayListScopedEmployees
    ? employeeWhere(a)
    : {id:a.user.employeeId||'__none__',companyId:a.companyId};
  const employees=await db.employee.findMany({
    where,
    select:{id:true,firstName:true,lastName:true,employeeNo:true},
    orderBy:[{firstName:'asc'},{lastName:'asc'}],
    take:500
  });
  return ok({employees});
}
