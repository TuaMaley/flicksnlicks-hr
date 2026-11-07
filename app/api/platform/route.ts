import {validateCompanyLogo} from '../../../lib/companyLogo';
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
 const [companies,users,roles,adminCreationLogs]=await Promise.all([
 db.company.findMany({include:{modules:true,memberships:{include:{user:{select:{id:true,name:true,email:true,active:true}},roles:{include:{role:{select:{id:true,name:true}}}}}}},orderBy:{createdAt:'desc'}}),
 db.user.findMany({select:{id:true,name:true,email:true,active:true},orderBy:{name:'asc'},take:1000}),
 db.role.findMany({where:{active:true},select:{id:true,name:true},orderBy:{name:'asc'}}),
 db.auditLog.findMany({where:{action:{in:['PLATFORM_COMPANY_ADMIN_INVITED','PLATFORM_COMPANY_ADMIN_CREATED']},entity:'User',entityId:{not:null}},select:{entityId:true}})
 ]);
 const adminIds=new Set(adminCreationLogs.map(log=>log.entityId));
 const companyAdministratorCandidates=users.filter(u=>u.active&&adminIds.has(u.id));
 return NextResponse.json({companies,users,roles,companyAdministratorCandidates,moduleCatalog:modules},{headers:{'Cache-Control':'private, no-store'}});
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
   await tx.branch.create({data:{companyId:c.id,name:'Head Office'}});
   await tx.auditLog.create({data:{actorId:a.user.id,action:'PLATFORM_COMPANY_CREATED',entity:'Company',entityId:c.id,detail:{name,code}}});
   return c;
  });
  return NextResponse.json({company},{status:201});
 }
 if(action==='updateCompany'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const name=typeof body.name==='string'?body.name.trim():'';
  const country=typeof body.country==='string'?body.country.trim():'';
  const email=typeof body.email==='string'?body.email.trim():'';
  const phone=typeof body.phone==='string'?body.phone.trim():'';
  if(!companyId||name.length<2||name.length>120||country.length>80||email.length>254||phone.length>60|| (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return NextResponse.json({error:'Invalid company profile'},{status:400});
  let logoDataUrl:string|null|undefined;try{logoDataUrl=body.logoDataUrl===undefined?undefined:validateCompanyLogo(body.logoDataUrl)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
  const company=await db.company.findUnique({where:{id:companyId}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});
  const updated=await db.$transaction(async tx=>{
   const result=await tx.company.update({where:{id:companyId},data:{name,country:country||null,email:email||null,phone:phone||null,...(logoDataUrl===undefined?{}:{logoDataUrl})}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_UPDATED',entity:'Company',entityId:companyId,detail:{previous:{name:company.name,country:company.country,email:company.email,phone:company.phone},current:{name,country,email,phone,logoReplaced:!!logoDataUrl}}}});
   return result;
  });
  return NextResponse.json({company:updated});
 }
 if(action==='setCompanyStatus'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const active=body.active;
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!companyId||typeof active!=='boolean'||reason.length<8||reason.length>500)return NextResponse.json({error:'Company, status and reason (8–500 characters) required'},{status:400});
  const company=await db.company.findUnique({where:{id:companyId}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});
  if(company.active===active)return NextResponse.json({error:'Company already has that status'},{status:409});
  await db.$transaction(async tx=>{
   await tx.company.update({where:{id:companyId},data:{active}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:active?'PLATFORM_COMPANY_ACTIVATED':'PLATFORM_COMPANY_SUSPENDED',entity:'Company',entityId:companyId,detail:{previousActive:company.active,active,reason}}});
  });
  return NextResponse.json({success:true});
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
  // The shared Administrator definition is provisioned if missing. Company privileges
  // are assigned only through membership roles, never through global UserRole.
  const result=await db.$transaction(async tx=>{
   // Prefer a dedicated company role. Do not reassign or deactivate another
   // company's existing Administrator role (legacy roles have globally unique names).
   const roleName=`Administrator [${company.id}]`;
   let adminRole=await tx.role.findUnique({where:{name:roleName}});
   if(adminRole && (adminRole.companyId!==company.id || !adminRole.active))throw new Error('ADMIN_ROLE_CONFIGURATION');
   if(!adminRole){
    const permissions=await tx.permission.findMany({select:{id:true}});
    if(!permissions.length)throw new Error('PERMISSION_CATALOG_MISSING');
    adminRole=await tx.role.create({data:{name:roleName,companyId:company.id,description:'Company HRMS Administrator',system:true,protected:true,active:true,permissions:{create:permissions.map(p=>({permissionId:p.id}))}}});
   }
   const u=await tx.user.create({data:{name,email,passwordHash:hashPassword(password),active:true,platformAdmin:false}});
   const m=await tx.companyMembership.create({data:{companyId,userId:u.id,active:true,roles:{create:{roleId:adminRole.id}}}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_ADMIN_CREATED',entity:'User',entityId:u.id,detail:{companyId,membershipId:m.id,roleId:adminRole.id}}});
   return {userId:u.id,membershipId:m.id};
  });
  return NextResponse.json({success:true,...result},{status:201});
 }
 if(action==='assignCompanyAdministrator'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const userId=typeof body.userId==='string'?body.userId:'';
  if(!companyId||!userId)return NextResponse.json({error:'Select a company and Nexora-created administrator'},{status:400});
  const [company,user,creationLog]=await Promise.all([
   db.company.findUnique({where:{id:companyId},select:{id:true,active:true}}),
   db.user.findUnique({where:{id:userId},select:{id:true,active:true,platformAdmin:true}}),
   db.auditLog.findFirst({where:{entity:'User',entityId:userId,action:{in:['PLATFORM_COMPANY_ADMIN_INVITED','PLATFORM_COMPANY_ADMIN_CREATED']}},select:{id:true}})
  ]);
  if(!company?.active||!user?.active||user.platformAdmin||!creationLog)return NextResponse.json({error:'An active company and a Nexora-created company administrator are required'},{status:400});
  await db.$transaction(async tx=>{
   const roleName=`Administrator [${companyId}]`;
   let role=await tx.role.findUnique({where:{name:roleName}});
   if(role&&(!role.active||role.companyId!==companyId))throw new Error('ADMIN_ROLE_CONFIGURATION');
   if(!role){
    const permissions=await tx.permission.findMany({select:{id:true}});
    if(!permissions.length)throw new Error('PERMISSION_CATALOG_MISSING');
    role=await tx.role.create({data:{name:roleName,companyId,description:'Company HRMS Administrator',system:true,protected:true,active:true,permissions:{create:permissions.map(p=>({permissionId:p.id}))}}});
   }
   const membership=await tx.companyMembership.upsert({where:{companyId_userId:{companyId,userId}},create:{companyId,userId,active:true},update:{active:true}});
   await tx.companyMembershipRole.upsert({where:{membershipId_roleId:{membershipId:membership.id,roleId:role.id}},create:{membershipId:membership.id,roleId:role.id},update:{}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_ADMIN_ASSIGNED',entity:'User',entityId:userId,detail:{membershipId:membership.id,roleId:role.id}}});
  });
  return NextResponse.json({success:true});
 }
 if(action==='updateCompanyMember'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const userId=typeof body.userId==='string'?body.userId:'';
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(name.length<2||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'Valid name and email required'},{status:400});
  const membership=await db.companyMembership.findUnique({where:{companyId_userId:{companyId,userId}},include:{user:{select:{name:true,email:true,platformAdmin:true}}}});
  if(!membership?.active||membership.user.platformAdmin)return NextResponse.json({error:'Active company member not found'},{status:404});
  await db.$transaction(async tx=>{
   await tx.user.update({where:{id:userId},data:{name,email}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_MEMBER_UPDATED',entity:'User',entityId:userId,detail:{previous:{name:membership.user.name,email:membership.user.email},current:{name,email}}}});
  });
  return NextResponse.json({success:true});
 }
 if(action==='removeCompanyMember'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const userId=typeof body.userId==='string'?body.userId:'';
  const membership=await db.companyMembership.findUnique({where:{companyId_userId:{companyId,userId}},include:{user:{select:{platformAdmin:true}}}});
  if(!membership?.active||membership.user.platformAdmin)return NextResponse.json({error:'Active company member not found'},{status:404});
  await db.$transaction(async tx=>{
   await tx.companyMembership.update({where:{id:membership.id},data:{active:false}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_MEMBER_REMOVED',entity:'User',entityId:userId,detail:{membershipId:membership.id}}});
  });
  return NextResponse.json({success:true});
 }
 if(action==='deleteCompanyUserAccount'){
  const companyId=typeof body.companyId==='string'?body.companyId:'';
  const userId=typeof body.userId==='string'?body.userId:'';
  if(!companyId||!userId||userId===a.user.id)return NextResponse.json({error:'Invalid account deletion request'},{status:400});
  try{
   await db.$transaction(async tx=>{
    const user=await tx.user.findUnique({where:{id:userId},select:{id:true,active:true,platformAdmin:true}});
    if(!user?.active||user.platformAdmin)throw new Error('ACCOUNT_NOT_ELIGIBLE');
    const memberships=await tx.companyMembership.findMany({where:{userId,active:true},select:{id:true,companyId:true}});
    if(memberships.length!==1||memberships[0].companyId!==companyId)throw new Error('OTHER_ACTIVE_MEMBERSHIPS');
    await tx.companyMembership.update({where:{id:memberships[0].id},data:{active:false}});
    // Retain the immutable user ID for historical references, but release the unique email.
    // This is a deactivation, not a physical delete of records linked to audits or HRMS.
    await tx.user.update({where:{id:userId},data:{active:false,email:`deleted-${userId}@invalid.nexora.local`,passwordHash:`disabled-${userId}`}});
    await tx.auditLog.create({data:{actorId:a.user.id,companyId,action:'PLATFORM_COMPANY_USER_ACCOUNT_DELETED',entity:'User',entityId:userId,detail:{membershipId:memberships[0].id,emailReleased:true}}});
   });
   return NextResponse.json({success:true});
  }catch(e:any){
   if(e?.message==='OTHER_ACTIVE_MEMBERSHIPS')return NextResponse.json({error:'This user has another active company membership. Remove their other memberships before deleting the account.'},{status:409});
   if(e?.message==='ACCOUNT_NOT_ELIGIBLE')return NextResponse.json({error:'This account cannot be deleted'},{status:403});
   throw e;
  }
 }
 if(action==='addMembership'){
  if(typeof body.companyId!=='string'||typeof body.userId!=='string')return NextResponse.json({error:'Select company and user'},{status:400});
  const [company,user]=await Promise.all([db.company.findUnique({where:{id:body.companyId}}),db.user.findUnique({where:{id:body.userId}})]);
  if(!company?.active||!user?.active||user.platformAdmin)return NextResponse.json({error:'Company and user must be active, and platform administrators cannot be assigned company memberships'},{status:400});
  await db.$transaction(async tx=>{
   await tx.companyMembership.upsert({where:{companyId_userId:{companyId:company.id,userId:user.id}},create:{companyId:company.id,userId:user.id},update:{active:true}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId:company.id,action:'PLATFORM_MEMBERSHIP_ASSIGNED',entity:'Company',entityId:company.id,detail:{userId:user.id}}});
  });
  return NextResponse.json({success:true});
 }
 if(action==='setMembershipRole'){
  if(typeof body.membershipId!=='string'||typeof body.roleId!=='string')return NextResponse.json({error:'Membership and role required'},{status:400});
  const [membership,role]=await Promise.all([db.companyMembership.findUnique({where:{id:body.membershipId}}),db.role.findUnique({where:{id:body.roleId}})]);
  if(!membership?.active||!role?.active|| (role.companyId && role.companyId!==membership.companyId))return NextResponse.json({error:'Active membership and eligible role required'},{status:404});
  const [memberUser,memberCompany]=await Promise.all([db.user.findUnique({where:{id:membership.userId},select:{active:true,platformAdmin:true}}),db.company.findUnique({where:{id:membership.companyId},select:{active:true}})]);
  if(!memberUser?.active||memberUser.platformAdmin||!memberCompany?.active)return NextResponse.json({error:'User and company must be active, and platform administrators cannot receive company roles'},{status:403});
  await db.$transaction(async tx=>{
   await tx.companyMembershipRole.upsert({where:{membershipId_roleId:{membershipId:membership.id,roleId:role.id}},create:{membershipId:membership.id,roleId:role.id},update:{}});
   await tx.auditLog.create({data:{actorId:a.user.id,companyId:membership.companyId,action:'PLATFORM_MEMBERSHIP_ROLE_ASSIGNED',entity:'Company',entityId:membership.companyId,detail:{userId:membership.userId,roleId:role.id}}});
  });
  return NextResponse.json({success:true});
 }
 return NextResponse.json({error:'Unsupported action'},{status:400});
 }catch(e:any){console.error('Platform action failed',e);const duplicate=e?.code==='P2002';const configuration=e?.message==='ADMIN_ROLE_CONFIGURATION'||e?.message==='PERMISSION_CATALOG_MISSING';return NextResponse.json({error:duplicate?'Company code or user email already exists':e?.message==='ADMIN_ROLE_CONFIGURATION'?'Administrator role is inactive or assigned to another company':e?.message==='PERMISSION_CATALOG_MISSING'?'Permission catalog is empty; run the existing bootstrap script':'Unable to complete platform action'},{status:duplicate||configuration?409:500})}
}
