import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
const KEYS=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'];
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
async function inspect(companyId:string,planId:string){
 const [company,plan,modules]=await Promise.all([db.company.findUnique({where:{id:companyId},select:{id:true,name:true,active:true}}),db.subscriptionPlan.findUnique({where:{id:planId}}),db.companyModule.findMany({where:{companyId,enabled:true},select:{moduleKey:true}})]);
 if(!company||!company.active||!plan||!plan.active)return null;
 const desired=[...new Set(Array.isArray(plan.moduleKeys)?plan.moduleKeys.filter((v):v is string=>typeof v==='string'&&KEYS.includes(v)):[])];
 const current=modules.map(m=>m.moduleKey);
 return {company,plan:{id:plan.id,name:plan.name,currency:plan.currency},desired,current,enable:desired.filter(k=>!current.includes(k)),disable:current.filter(k=>!desired.includes(k))};
}
export async function GET(req:NextRequest){
 if(!await guard())return NextResponse.json({error:'Forbidden'},{status:403});
 const companyId=req.nextUrl.searchParams.get('companyId')||'',planId=req.nextUrl.searchParams.get('planId')||'';
 const result=await inspect(companyId,planId);return result?NextResponse.json(result):NextResponse.json({error:'Active company or plan not found'},{status:404});
}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Forbidden'},{status:403});
 const b=await req.json().catch(()=>null);
 const companyId=typeof b?.companyId==='string'?b.companyId:'',planId=typeof b?.planId==='string'?b.planId:'';
 const reason=typeof b?.reason==='string'?b.reason.trim():'';
 const startsAt=new Date(b?.startsAt),endsAt=new Date(b?.endsAt);
 if(b?.confirm!==true||reason.length<8||reason.length>500||!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)
 return NextResponse.json({error:'Explicit confirmation, reason (8–500 characters), and valid subscription dates required'},{status:400});
 const p=await inspect(companyId,planId);if(!p)return NextResponse.json({error:'Active company or plan not found'},{status:404});
 // Keep subscription and module entitlement changes in one transaction.
 try{
 const result=await db.$transaction(async tx=>{
  const overlap=await tx.platformSubscription.findFirst({where:{companyId,status:'ACTIVE',startsAt:{lt:endsAt},endsAt:{gt:startsAt}}});
  if(overlap)throw Error('An active subscription already overlaps these dates.');
  const sub=await tx.platformSubscription.create({data:{companyId,planName:p.plan.name,startsAt,endsAt,notes:'Activated with plan module package. Reason: '+reason}});
  for(const key of KEYS)await tx.companyModule.upsert({where:{companyId_moduleKey:{companyId,moduleKey:key}},create:{companyId,moduleKey:key,enabled:p.desired.includes(key)},update:{enabled:p.desired.includes(key)}});
  await tx.auditLog.create({data:{actorId:u.id,companyId,action:'PLATFORM_SUBSCRIPTION_LICENSE_ACTIVATED',entity:'PlatformSubscription',entityId:sub.id,detail:{planId,planName:p.plan.name,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),enabled:p.enable,disabled:p.disable,reason}}});
  return sub;
 });
 return NextResponse.json({success:true,subscriptionId:result.id});
 }catch(e:any){return NextResponse.json({error:e?.message==='An active subscription already overlaps these dates.'?e.message:'Unable to activate subscription; no changes were committed.'},{status:409})}
}
