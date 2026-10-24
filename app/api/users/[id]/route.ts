import {NextRequest} from 'next/server';import {db} from '../../../../lib/db';import {access,hashPassword} from '../../../../lib/auth';import {fail,ok} from '../../../../lib/http';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('access.users.manage'))return fail('Forbidden',403);
 const {id}=await params;const target=await db.user.findUnique({where:{id},include:{roles:{include:{role:true}}}});if(!target)return fail('Not found',404);
 const d=await req.json().catch(()=>null);if(!d||!Array.isArray(d.roleIds)||!d.roleIds.length||!Array.isArray(d.scopes)||typeof d.name!=='string'||d.name.trim().length<2||typeof d.active!=='boolean')return fail('Invalid user settings');
 if(d.password!==undefined&&(typeof d.password!=='string'||d.password.length<12))return fail('Password must contain 12+ characters');
 if(d.scopes.length>100||d.scopes.some((s:any)=>!s||typeof s!=='object'||(s.branchId&&typeof s.branchId!=='string')||(s.department&&typeof s.department!=='string')||(!s.branchId&&!s.department)))return fail('Invalid access scopes');
 const roles=await db.role.findMany({where:{id:{in:d.roleIds},active:true}});if(roles.length!==new Set(d.roleIds).size)return fail('Invalid roles');
 const isAdmin=a.user.roles.some(r=>r.role.active&&r.role.name==='Administrator');if((roles.some(r=>r.protected)||target.roles.some(r=>r.role.protected))&&!isAdmin)return fail('Administrator required',403);
 const newAdmin=roles.some(r=>r.name==='Administrator');const oldAdmin=target.roles.some(r=>r.role.name==='Administrator');
 if(id===a.user.id&&(!d.active||!newAdmin))return fail('Cannot remove your own administrator access',403);
 if(oldAdmin&&(!newAdmin||!d.active)){const remaining=await db.user.count({where:{id:{not:id},active:true,roles:{some:{role:{name:'Administrator',active:true}}}}});if(!remaining)return fail('Cannot remove last active administrator',409)}
 const scopes=d.scopes.map((s:any)=>({branchId:s.branchId||null,department:s.department?.trim()||null}));
 if(new Set(scopes.map((s:any)=>`${s.branchId||''}:${s.department||''}`)).size!==scopes.length)return fail('Duplicate scopes');
 const branchIds=[...new Set(scopes.map((s:any)=>s.branchId).filter(Boolean))] as string[];
 if(branchIds.length&&(await db.branch.count({where:{id:{in:branchIds}}}))!==branchIds.length)return fail('Invalid branch');
 if(d.employeeId&&!(await db.employee.findUnique({where:{id:d.employeeId}})))return fail('Employee not found');
 try{await db.$transaction(async tx=>{await tx.userRole.deleteMany({where:{userId:id}});await tx.userRole.createMany({data:roles.map(r=>({userId:id,roleId:r.id}))});await tx.userAccessScope.deleteMany({where:{userId:id}});if(scopes.length)await tx.userAccessScope.createMany({data:scopes.map((s:any)=>({...s,userId:id}))});await tx.user.update({where:{id},data:{name:d.name.trim(),active:d.active,employeeId:d.employeeId||null,...(d.password?{passwordHash:hashPassword(d.password)}:{})}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'USER_ACCESS_UPDATED',entity:'User',entityId:id,detail:{roles:roles.map(r=>r.name),scopes,active:d.active,passwordReset:!!d.password}}})});return ok({success:true})}catch(e:any){if(e?.code==='P2002')return fail('Employee is already linked',409);return fail('Could not update user',500)}
}
