import {NextRequest} from 'next/server';
import {db} from '../../../lib/db';
import {access,hashPassword} from '../../../lib/auth';
import {selectedCompany} from '../../../lib/companyContext';
import {fail,ok} from '../../../lib/http';

async function authorizedCompany(userId:string){
 const ctx=await selectedCompany();
 if(!ctx?.selected || ctx.user.id!==userId)return null;
 return ctx.selected.companyId;
}
export async function GET(){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('access.users.manage'))return fail('Forbidden',403);
 const companyId=await authorizedCompany(a.user.id);if(!companyId)return fail('Select an authorized company',403);
 const memberships=await db.companyMembership.findMany({where:{companyId,active:true},select:{userId:true}});
 const ids=memberships.map(m=>m.userId);
 return ok({users:await db.user.findMany({where:{id:{in:ids}},select:{id:true,name:true,email:true,active:true,roles:{select:{role:{select:{id:true,name:true}}}},scopes:true},orderBy:{createdAt:'desc'},take:200})});
}
export async function POST(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('access.users.manage'))return fail('Forbidden',403);
 const companyId=await authorizedCompany(a.user.id);if(!companyId)return fail('Select an authorized company',403);
 try{
  const d=await req.json();
  if(typeof d.email!=='string'||!d.email.trim()||typeof d.name!=='string'||!d.name.trim()||typeof d.password!=='string'||d.password.length<12||!Array.isArray(d.roleIds)||!d.roleIds.length||d.roleIds.some((x:unknown)=>typeof x!=='string'))return fail('Name, email, password (12+ characters), and role are required');
  const roles=await db.role.findMany({where:{id:{in:d.roleIds},active:true,OR:[{companyId},{companyId:null}]}});
  if(roles.length!==new Set(d.roleIds).size)return fail('Invalid or unauthorized roles');
  const actorAdmin=a.user.roles.some(r=>r.role.active&&r.role.name==='Administrator');
  if(roles.some(r=>r.protected)&&!actorAdmin)return fail('Protected role assignment requires administrator',403);
  const scopes=Array.isArray(d.scopes)?d.scopes:[];
  if(scopes.length>100||scopes.some((s:any)=>!s||typeof s!=='object'||(!s.branchId&&!s.department)||(s.branchId&&typeof s.branchId!=='string')||(s.department&&typeof s.department!=='string')))return fail('Invalid scopes');
  const branchIds=[...new Set(scopes.map((s:any)=>s.branchId).filter(Boolean))] as string[];
  if(branchIds.length&&(await db.branch.count({where:{id:{in:branchIds},companyId}}))!==branchIds.length)return fail('Invalid company branch');
  if(new Set(scopes.map((s:any)=>`${s.branchId||''}:${s.department||''}`)).size!==scopes.length)return fail('Duplicate scopes');
  const employeeId=typeof d.employeeId==='string'&&d.employeeId?d.employeeId:null;
  if(employeeId&&!(await db.employee.findFirst({where:{id:employeeId,companyId},select:{id:true}})))return fail('Employee not in active company',403);
  const user=await db.$transaction(async tx=>{
   const u=await tx.user.create({data:{email:d.email.trim().toLowerCase(),name:d.name.trim(),passwordHash:hashPassword(d.password),employeeId,roles:{create:roles.map(r=>({roleId:r.id}))},scopes:{create:scopes.map((s:any)=>({branchId:s.branchId||null,department:s.department?.trim()||null}))}}});
   await tx.companyMembership.create({data:{companyId,userId:u.id,active:true}});
   await tx.auditLog.create({data:{companyId,actorId:a.user!.id,action:'USER_CREATED',entity:'User',entityId:u.id,detail:{roles:roles.map(r=>r.name),companyId}}});
   return u;
  });
  return ok({id:user.id},201);
 }catch(e:any){if(e?.code==='P2002')return fail('Email or employee already linked',409);return fail('Unable to create user',500)}
}
