import {access} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {fail,ok} from '../../../lib/http';
export async function GET(){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 const platform=await db.user.findUnique({where:{id:a.user.id},select:{platformAdmin:true}});
 const employee = a.companyId && a.user.employeeId
  ? await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{profilePhotoDataUrl:true}})
  : null;
 return ok({profilePhotoDataUrl:employee?.profilePhotoDataUrl ?? null,name:a.user.name,email:a.user.email,employeeId:a.user.employeeId,permissions:[...a.keys],roles:a.user.roles.map(r=>r.role.name),platformAdmin:platform?.platformAdmin===true});
}
