import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

const CATALOG=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'];
async function guard(){
 const u=await currentUser();if(!u)return null;
 const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});
 return a?.active&&a.platformAdmin?u:null;
}
async function assignedPlanId(companyId:string){
 const now=new Date();
 const subscription=await db.platformSubscription.findFirst({where:{companyId,status:'ACTIVE',startsAt:{lte:now},endsAt:{gt:now}},orderBy:{startsAt:'desc'},select:{planName:true}});
 if(!subscription)return null;
 const plans=await db.subscriptionPlan.findMany({where:{active:true},select:{id:true,name:true}});
 return plans.find(p=>p.name.trim().toLowerCase()===subscription.planName.trim().toLowerCase())?.id||null;
}
async function preview(companyId:string,planId:string){
 const [company,plan,assignments]=await Promise.all([
  db.company.findUnique({where:{id:companyId},select:{id:true,name:true}}),
  db.subscriptionPlan.findUnique({where:{id:planId}}),
  db.companyModule.findMany({where:{companyId},select:{moduleKey:true,enabled:true}})
 ]);
 if(!company||!plan||!plan.active)return {error:'Company or active plan not found'} as const;
 const keys=Array.isArray(plan.moduleKeys)?plan.moduleKeys.filter((k):k is string=>typeof k==='string'&&CATALOG.includes(k)):[];
 const current=assignments.filter(a=>a.enabled).map(a=>a.moduleKey);
 return {company,plan:{id:plan.id,name:plan.name,currency:plan.currency},desired:[...new Set(keys)],current,enable:keys.filter(k=>!current.includes(k)),disable:current.filter(k=>!keys.includes(k))};
}
export async function GET(req:NextRequest){
 if(!await guard())return NextResponse.json({error:'Forbidden'},{status:403});
 const companyId=req.nextUrl.searchParams.get('companyId')||'',planId=req.nextUrl.searchParams.get('planId')||'';
 if(!companyId||!planId)return NextResponse.json({error:'Company and plan required'},{status:400});
 if(await assignedPlanId(companyId)!==planId)return NextResponse.json({error:'Only the company’s current active subscription plan can be applied'},{status:403});
 const p=await preview(companyId,planId);
 if('error'in p)return NextResponse.json(p,{status:404});
 return NextResponse.json(p,{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Forbidden'},{status:403});
 const b=await req.json().catch(()=>null);
 const companyId=typeof b?.companyId==='string'?b.companyId:'',planId=typeof b?.planId==='string'?b.planId:'';
 const reason=typeof b?.reason==='string'?b.reason.trim():'';
 if(!companyId||!planId||reason.length<8||reason.length>500||b?.confirm!==true)return NextResponse.json({error:'Company, plan, confirmation and reason (8–500 characters) required'},{status:400});
 if(await assignedPlanId(companyId)!==planId)return NextResponse.json({error:'Only the company’s current active subscription plan can be applied'},{status:403});
 const p=await preview(companyId,planId);if('error'in p)return NextResponse.json(p,{status:404});
 // Explicit confirmation only: never run on subscription save or expiry.
 await db.$transaction(async tx=>{
  for(const key of CATALOG){
   await tx.companyModule.upsert({where:{companyId_moduleKey:{companyId,moduleKey:key}},create:{companyId,moduleKey:key,enabled:p.desired.includes(key)},update:{enabled:p.desired.includes(key)}});
  }
  await tx.auditLog.create({data:{actorId:u.id,companyId,action:'PLATFORM_PLAN_MODULES_APPLIED',entity:'Company',entityId:companyId,detail:{planId,planName:p.plan.name,enabled:p.enable,disabled:p.disable,reason}}});
 });
 return NextResponse.json({success:true,enabled:p.enable,disabled:p.disable});
}
