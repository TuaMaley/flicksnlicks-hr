import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
const KEYS=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'];
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 if(!b||!['PREVIEW','APPLY'].includes(b.action)||!['RENEW','CHANGE'].includes(b.mode)||typeof b.subscriptionId!=='string')
 return NextResponse.json({error:'Invalid request'},{status:400});
 const sub=await db.platformSubscription.findUnique({where:{id:b.subscriptionId}});
 if(!sub||sub.status!=='ACTIVE')return NextResponse.json({error:'Active subscription not found'},{status:404});
 let details:any;
 let plan:any=null;
 if(b.mode==='RENEW'){
  const newEnd=new Date(b.endDate);
  if(!Number.isFinite(newEnd.getTime())||newEnd<=sub.endsAt)return NextResponse.json({error:'New expiry must be later than current expiry'},{status:400});
  const conflict=await db.platformSubscription.findFirst({where:{companyId:sub.companyId,id:{not:sub.id},status:'ACTIVE',startsAt:{lt:newEnd},endsAt:{gt:sub.endsAt}}});
  if(conflict)return NextResponse.json({error:'Renewal overlaps another active subscription'},{status:409});
  details={previousEndDate:sub.endsAt.toISOString().slice(0,10),newEndDate:newEnd.toISOString().slice(0,10)};
 }else{
  if(typeof b.planId!=='string')return NextResponse.json({error:'Plan required'},{status:400});
  plan=await db.subscriptionPlan.findUnique({where:{id:b.planId}});
  if(!plan||!plan.active)return NextResponse.json({error:'Active plan not found'},{status:404});
  const rawKeys: unknown[] = Array.isArray(plan.moduleKeys) ? plan.moduleKeys : [];
  const desired: string[] = [...new Set<string>(rawKeys.filter((k): k is string => typeof k === 'string' && KEYS.includes(k)))];
  const current=(await db.companyModule.findMany({where:{companyId:sub.companyId,enabled:true},select:{moduleKey:true}})).map(x=>x.moduleKey);
  details={oldPlan:sub.planName,newPlan:plan.name,enable:desired.filter(k=>!current.includes(k)),disable:current.filter(k=>!desired.includes(k)),desired};
 }
 if(b.action==='PREVIEW')return NextResponse.json(details);
 const reason=typeof b.reason==='string'?b.reason.trim():'';
 if(b.confirm!==true||reason.length<8||reason.length>500)return NextResponse.json({error:'Confirmation and reason (8–500 characters) required'},{status:400});
 try{
 await db.$transaction(async tx=>{
  if(b.mode==='RENEW'){
   await tx.platformSubscription.update({where:{id:sub.id},data:{endsAt:new Date(b.endDate)}});
  }else{
   await tx.platformSubscription.update({where:{id:sub.id},data:{planName:plan.name}});
   for(const key of KEYS)await tx.companyModule.upsert({where:{companyId_moduleKey:{companyId:sub.companyId,moduleKey:key}},create:{companyId:sub.companyId,moduleKey:key,enabled:details.desired.includes(key)},update:{enabled:details.desired.includes(key)}});
  }
  await tx.auditLog.create({data:{actorId:u.id,companyId:sub.companyId,action:b.mode==='RENEW'?'PLATFORM_SUBSCRIPTION_RENEWED':'PLATFORM_SUBSCRIPTION_PLAN_CHANGED',entity:'PlatformSubscription',entityId:sub.id,detail:{...details,reason}}});
 });
 return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Update failed; changes were not committed'},{status:409})}
}
