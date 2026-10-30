import {NextRequest,NextResponse} from 'next/server';
import {currentUser,hashPassword} from '../../../lib/auth';
import {db} from '../../../lib/db';
const modules=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'];
async function guard(){
 const user=await currentUser();
 if(!user)return {error:'Unauthorized',status:401} as const;
 const check=await db.user.findUnique({where:{id:user.id},select:{platformAdmin:true,active:true}});
 if(!check?.active||!check.platformAdmin)return {error:'Platform administrator access required',status:403} as const;
 return {user} as const;
}
export async function GET(){
 const a=await guard();if('error'in a)return NextResponse.json({error:a.error},{status:a.status});
 const [companies,users,roles]=await Promise.all([
 db.company.findMany({include:{modules:true,memberships:{include:{user:{select:{id:true,name:true,email:true,active:true}},roles:{include:{role:{select:{id:true,name:true}}}}}}},orderBy:{createdAt:'desc'}}),
 db.user.findMany({select:{id:true,name:true,email:true,active:true},orderBy:{name:'asc'},take:1000}),
 db.role.findMany({where:{active:true},select:{id:true,name:true},orderBy:{name:'asc'}})
 ]);
 return NextResponse.json({companies,users,roles,moduleCatalog:modules},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 const a=await guard();if('error'in a)return NextResponse.json({error:a.error},{status:a.status});
 const body=await req.json().catch(()=>null);
 const action=body?.action;
 try{
 if(action==='createCompany'){
  const name=typeof body.name==='string'?body.name.trim():'';
  const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
  if(name.length<2||name.length>120||! /^[A-Z0-9_-]{2,30}$/.test(code))return NextResponse.json({error:'Valid company name and 2–30 character alphanumeric code required'},{status:400});
  const company=await db.$transaction(async tx=>{
   const c=await tx.company.create({data:{name,code,country:typeof body.country==='string'?body.country.slice(0,80):null}});
   await tx.auditLog.create({data:{actorId:a.user.id,action:'PLATFORM_COMPANY_CREATED',entity:'Company',entityId:c.id,detail:{name,code}}});
   return c;
  });
  return NextResponse.json({company},{status:201});
 }
 if(action==='setModule'){
  if(typeof body.companyId!=='string'||!modules.includes(body.moduleKey)||typeof body.enabled!=='boolean')return NextResponse.json({error:'Invalid module assignment'},{status:400});
  const company=await db.company.findUnique({where:{id:body.companyId}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});
  await db.$transaction(async tx=>{
   await tx.companyModule.upsert({where:{companyId_moduleKey:{companyId:company.id,moduleKey:body.moduleKey}},create:{companyId:company.id,moduleKey:body.moduleKey,enabled:body.enabled},update:{enabled:body.enabled}});
   await tx.auditLog.create({data:{actorId:a.user.id,action:'PLATFORM_MODULE_CHANGED',entity:'Company',entityId:company.id,detail:{moduleKey:body.moduleKey,enabled:body.enabled}}});
  });
  return NextResponse.json({success:true});
 }
 if(action==='createCompanyAdmin'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(name.length<2||name.length>120||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>256)
   return NextResponse.json({error:'Valid name, email and password (12–256 characters) required'},{status:400});
  const company=await db.company.findUnique({where:{id:companyId},select:{id:true,active:true}});
  if(!company?.active)return NextResponse.json({error:'Select an active company'},{status:400});
  // Existing HRMS operational authorization still uses UserRole, not only CompanyMembershipRole.
  // Only the platform administrator can perform this bootstrap operation.
  const adminRole=await db.role.findFirst({where:{name:'Administrator',active:true,OR:[{companyId:null},{companyId}]},select:{id:true,name:true}});
  if(!adminRole)return NextResponse.json({error:'Active Administrator role not configured'},{status:409});
  const result=await db.$transaction(async tx=>{
   const u=await tx.user.create({data:{name,email,passwordHash:hashPassword(password),active:true,platformAdmin:false,roles:{create:{roleId:adminRole.id}}}});
   const m=await tx.companyMembership.create({data:{companyId,userId:u.id,active:true,roles:{create:{roleId:adminRole.id}}}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_ADMIN_CREATED',entity:'User',entityId:u.id,detail:{companyId,membershipId:m.id,roleId:adminRole.id}}});
   return {userId:u.id,membershipId:m.id};
  });
  return NextResponse.json({success:true,...result},{status:201});
 }
 if(action==='addMembership'){
  if(typeof body.companyId!=='string'||typeof body.userId!=='string')return NextResponse.json({error:'Select company and user'},{status:400});
  const [company,user]=await Promise.all([db.company.findUnique({where:{id:body.companyId}}),db.user.findUnique({where:{id:body.userId}})]);
  if(!company||!user||user.platformAdmin)return NextResponse.json({error:'Invalid company or user'},{status:400});
  await db.$transaction(async tx=>{
   await tx.companyMembership.upsert({where:{companyId_userId:{companyId:company.id,userId:user.id}},create:{companyId:company.id,userId:user.id},update:{active:true}});
   await tx.auditLog.create({data:{actorId:a.user.id,action:'PLATFORM_MEMBERSHIP_ASSIGNED',entity:'Company',entityId:company.id,detail:{userId:user.id}}});
  });
  return NextResponse.json({success:true});
 }
 if(action==='setMembershipRole'){
  if(typeof body.membershipId!=='string'||typeof body.roleId!=='string')return NextResponse.json({error:'Membership and role required'},{status:400});
  const [membership,role]=await Promise.all([db.companyMembership.findUnique({where:{id:body.membershipId}}),db.role.findUnique({where:{id:body.roleId}})]);
  if(!membership||!role||!role.active)return NextResponse.json({error:'Membership or role not found'},{status:404});
  await db.$transaction(async tx=>{
   await tx.companyMembershipRole.upsert({where:{membershipId_roleId:{membershipId:membership.id,roleId:role.id}},create:{membershipId:membership.id,roleId:role.id},update:{}});
   await tx.auditLog.create({data:{actorId:a.user.id,action:'PLATFORM_MEMBERSHIP_ROLE_ASSIGNED',entity:'Company',entityId:membership.companyId,detail:{userId:membership.userId,roleId:role.id}}});
  });
  return NextResponse.json({success:true});
 }
 return NextResponse.json({error:'Unsupported action'},{status:400});
 }catch(e:any){console.error('Platform action failed',e);return NextResponse.json({error:e?.code==='P2002'?'Company code already exists':'Unable to complete platform action'},{status:e?.code==='P2002'?409:500})}
}
