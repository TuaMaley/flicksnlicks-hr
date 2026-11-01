import {NextRequest,NextResponse} from 'next/server';
import {currentUser,hashPassword} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

const KEYS=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'];
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
export async function GET(){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const [companies,plans]=await Promise.all([
  db.company.findMany({select:{id:true,name:true,code:true,active:true,createdAt:true,memberships:{where:{active:true},select:{roles:{select:{role:{select:{name:true}}}}}},modules:{where:{enabled:true},select:{moduleKey:true}},subscriptions:{select:{id:true,planName:true,status:true,startsAt:true,endsAt:true}}},orderBy:{createdAt:'desc'}}),
  db.subscriptionPlan.findMany({where:{active:true},select:{id:true,name:true,currency:true,moduleKeys:true},orderBy:{name:'asc'}})
 ]);
 const now=new Date();
 return NextResponse.json({plans,companies:companies.map(c=>{
  const admin=c.memberships.some(m=>m.roles.some(r=>r.role.name==='Administrator'||r.role.name.startsWith('Administrator [')));
  const sub=c.subscriptions.some(s=>s.status==='ACTIVE'&&s.startsAt<=now&&s.endsAt>now);
  const ready=admin&&sub&&c.modules.length>0;
  return {id:c.id,name:c.name,code:c.code,active:c.active,createdAt:c.createdAt,adminConfigured:admin,subscriptionActive:sub,enabledModules:c.modules.length,ready,status:!ready?'SETUP INCOMPLETE':c.active?'ACTIVE':'INACTIVE'};
 })},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 const name=typeof b?.name==='string'?b.name.trim():'';
 const code=typeof b?.code==='string'?b.code.trim().toUpperCase():'';
 const country=typeof b?.country==='string'?b.country.trim():'';
 const adminName=typeof b?.adminName==='string'?b.adminName.trim():'';
 const adminEmail=typeof b?.adminEmail==='string'?b.adminEmail.trim().toLowerCase():'';
 const password=typeof b?.password==='string'?b.password:'';
 const planId=typeof b?.planId==='string'?b.planId:'';
 const reason=typeof b?.reason==='string'?b.reason.trim():'';
 const startsAt=new Date(b?.startsAt),endsAt=new Date(b?.endsAt);
 if(b?.confirm!==true||name.length<2||name.length>120||!/^[A-Z0-9_-]{2,30}$/.test(code)||country.length>80||adminName.length<2||adminName.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)||adminEmail.length>254||password.length<12||password.length>256||reason.length<8||reason.length>500||!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt||endsAt<=new Date())return NextResponse.json({error:'Complete all fields, use a 12+ character password, valid future subscription dates, and a reason (8–500 characters).'},{status:400});
 const plan=await db.subscriptionPlan.findUnique({where:{id:planId}});
 if(!plan?.active)return NextResponse.json({error:'Select an active subscription plan'},{status:400});
 const moduleKeys=Array.isArray(plan.moduleKeys)?[...new Set(plan.moduleKeys.filter((k):k is string=>typeof k==='string'&&KEYS.includes(k)))]:[];
 if(moduleKeys.length===0)return NextResponse.json({error:'The selected plan has no valid HRMS modules. Configure its entitlements first.'},{status:400});
 try{
  const result=await db.$transaction(async tx=>{
   const permissions=await tx.permission.findMany({select:{id:true}});
   if(!permissions.length)throw Error('PERMISSION_CATALOG_MISSING');
   const company=await tx.company.create({data:{name,code,country:country||null,active:false}});
   await tx.branch.create({data:{companyId:company.id,name:'Head Office'}});
   const role=await tx.role.create({data:{name:`Administrator [${company.id}]`,companyId:company.id,description:'Company HRMS Administrator',system:true,protected:true,active:true,permissions:{create:permissions.map(p=>({permissionId:p.id}))}}});
   const user=await tx.user.create({data:{name:adminName,email:adminEmail,passwordHash:hashPassword(password),active:true,platformAdmin:false}});
   await tx.companyMembership.create({data:{companyId:company.id,userId:user.id,active:true,roles:{create:{roleId:role.id}}}});
   await tx.platformSubscription.create({data:{companyId:company.id,planName:plan.name,startsAt,endsAt,status:'ACTIVE',notes:'Initial onboarding subscription'}});
   for(const key of KEYS)await tx.companyModule.create({data:{companyId:company.id,moduleKey:key,enabled:moduleKeys.includes(key)}});
   await tx.company.update({where:{id:company.id},data:{active:true}});
   await tx.auditLog.create({data:{actorId:u.id,companyId:company.id,action:'PLATFORM_COMPANY_ONBOARDED',entity:'Company',entityId:company.id,detail:{companyCode:code,administratorId:user.id,planId:plan.id,planName:plan.name,modules:moduleKeys,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),reason}}});
   return {companyId:company.id,code};
  },{timeout:20000});
  return NextResponse.json({success:true,...result},{status:201});
 }catch(e:any){console.error('Platform onboarding failed',e);return NextResponse.json({error:e?.code==='P2002'?'Company code or administrator email already exists':e?.message==='PERMISSION_CATALOG_MISSING'?'Permission catalog is empty; initialize the platform permissions first':'Onboarding failed. No partial company setup was committed.'},{status:e?.code==='P2002'?409:500});}
}
