import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

export async function GET(){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 const canManage=a.user.roles.some(r=>r.role.active&&['HR Manager','Administrator','Branch Manager'].includes(r.role.name));
 if(!canManage||!a.can('appraisals.edit'))return fail('Forbidden',403);
 const employees=await db.employee.findMany({
  where:{AND:[employeeWhere(a),{id:{not:a.user.employeeId||'__none__'}}]},
  select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,branch:{select:{name:true}}},
  orderBy:[{firstName:'asc'},{lastName:'asc'}],
  take:2000
 });
 return ok({employees});
}
