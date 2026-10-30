import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,hashPassword} from '../../../../lib/auth';
import {selectedCompany} from '../../../../lib/companyContext';
import {fail,ok} from '../../../../lib/http';

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 if(!a.can('access.users.manage'))return fail('Forbidden',403);
 const ctx=await selectedCompany();
 if(!ctx?.selected||ctx.user.id!==a.user.id)return fail('Select an authorized company',403);
 const companyId=ctx.selected.companyId;
 const {id}=await params;
 const membership=await db.companyMembership.findFirst({where:{companyId,userId:id,active:true},include:{user:{include:{roles:{include:{role:true}}}}}});
 if(!membership)return fail('User not found in active company',404);
 const target=membership.user;
 if(target.platformAdmin)return fail('Platform administrator cannot be managed here',403);
 // Legacy UserRole, User.active, and UserAccessScope are shared across companies.
 // Refuse edits for multi-company users until membership-specific authorization is enforced.
 const otherMemberships=await db.companyMembership.count({where:{userId:id,companyId:{not:companyId}}});
 if(otherMemberships)return fail('Multi-company users must be managed through a company-specific access workflow',409);
 const d=await req.json().catch(()=>null);
 if(!d||!Array.isArray(d.roleIds)||!d.roleIds.length||d.roleIds.some((x:unknown)=>typeof x!=='string')||!Array.isArray(d.scopes)||typeof d.name!=='string'||d.name.trim().length<2||typeof d.active!=='boolean')return fail('Invalid user settings');
 if(d.password!==undefined&&(typeof d.password!=='string'||d.password.length<12))return fail('Password must contain 12+ characters');
 if(d.scopes.length>100||d.scopes.some((s:any)=>!s||typeof s!=='object'||(s.branchId&&typeof s.branchId!=='string')||(s.department&&typeof s.department!=='string')||(!s.branchId&&!s.department)))return fail('Invalid access scopes');
 const uniqueRoleIds=[...new Set(d.roleIds)] as string[];
 if(uniqueRoleIds.length!==d.roleIds.length)return fail('Duplicate roles');
 const roles=await db.role.findMany({where:{id:{in:uniqueRoleIds},active:true,OR:[{companyId},{companyId:null}]}});
 if(roles.length!==uniqueRoleIds.length)return fail('Invalid or unauthorized roles',403);
 const isAdmin=a.user.roles.some(r=>r.role.active&&r.role.name==='Administrator');
 if((roles.some(r=>r.protected)||target.roles.some(r=>r.role.protected))&&!isAdmin)return fail('Administrator required',403);
 const newAdmin=roles.some(r=>r.name==='Administrator');
 const oldAdmin=target.roles.some(r=>r.role.name==='Administrator');
 if(id===a.user.id&&(!d.active||!newAdmin))return fail('Cannot remove your own administrator access',403);
 if(oldAdmin&&(!newAdmin||!d.active)){
  const remaining=await db.user.count({where:{id:{not:id},active:true,companyMemberships:{some:{companyId,active:true}},roles:{some:{role:{name:'Administrator',active:true}}}}});
  if(!remaining)return fail('Cannot remove last active company administrator',409);
 }
 const scopes=d.scopes.map((s:any)=>({branchId:s.branchId||null,department:s.department?.trim()||null}));
 if(new Set(scopes.map((s:any)=>`${s.branchId||''}:${s.department||''}`)).size!==scopes.length)return fail('Duplicate scopes');
 const branchIds=[...new Set(scopes.map((s:any)=>s.branchId).filter(Boolean))] as string[];
 if(branchIds.length&&(await db.branch.count({where:{id:{in:branchIds},companyId}}))!==branchIds.length)return fail('Invalid company branch',403);
 // Employee linkage is not part of this UI's edit payload; preserve it by default.
 if(d.employeeId!==undefined){
  if(d.employeeId!==null&&d.employeeId!==''&&typeof d.employeeId!=='string')return fail('Invalid employee');
  if(d.employeeId&&!(await db.employee.findFirst({where:{id:d.employeeId,companyId},select:{id:true}})))return fail('Employee not in active company',403);
 }
 try{
  await db.$transaction(async tx=>{
   // Re-check membership within the transaction to avoid changing a user removed from this company.
   const valid=await tx.companyMembership.findFirst({where:{companyId,userId:id,active:true}});
   if(!valid)throw new Error('MEMBERSHIP_CHANGED');
   await tx.userRole.deleteMany({where:{userId:id}});
   await tx.userRole.createMany({data:roles.map(r=>({userId:id,roleId:r.id}))});
   await tx.userAccessScope.deleteMany({where:{userId:id}});
   if(scopes.length)await tx.userAccessScope.createMany({data:scopes.map((s:any)=>({...s,userId:id,companyId}))});
   await tx.user.update({where:{id},data:{name:d.name.trim(),active:d.active,...(d.employeeId!==undefined?{employeeId:d.employeeId||null}:{}),...(d.password?{passwordHash:hashPassword(d.password)}:{})}});
   await tx.auditLog.create({data:{companyId,actorId:a.user!.id,action:'USER_ACCESS_UPDATED',entity:'User',entityId:id,detail:{roles:roles.map(r=>r.name),scopes,active:d.active,passwordReset:!!d.password}}});
  });
  return ok({success:true});
 }catch(e:any){
  if(e?.message==='MEMBERSHIP_CHANGED')return fail('Membership changed; refresh and try again',409);
  if(e?.code==='P2002')return fail('Employee is already linked',409);
  return fail('Could not update user',500);
 }
}
