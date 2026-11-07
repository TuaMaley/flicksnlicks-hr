import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
export async function GET(){if(!await guard())return NextResponse.json({error:'Forbidden'},{status:403});const [plans,modules]=await Promise.all([db.subscriptionPlan.findMany({orderBy:{name:'asc'}}),db.companyModule.findMany({select:{moduleKey:true},distinct:['moduleKey']})]);return NextResponse.json({plans:plans.map(p=>({...p,monthlyPrice:Number(p.monthlyPrice),annualPrice:Number(p.annualPrice)})),moduleKeys:modules.map(m=>m.moduleKey).sort()},{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Forbidden'},{status:403});
 const b=await req.json().catch(()=>null);
 const id=typeof b?.id==='string'?b.id.trim():'';
 const currency=typeof b?.currency==='string'?b.currency.trim().toUpperCase():'';
 const monthlyPrice=Number(b?.monthlyPrice);
 if(!id||!['GHS','USD'].includes(currency)||!Number.isFinite(monthlyPrice)||monthlyPrice<0||monthlyPrice>999999999)return NextResponse.json({error:'Invalid plan pricing'},{status:400});
 const annualPrice=Math.round(monthlyPrice*1200)/100;
 try{
  const plan=await db.$transaction(async tx=>{
   const existing=await tx.subscriptionPlan.findUnique({where:{id}});
   if(!existing)throw Object.assign(new Error('Plan not found'),{code:'P2025'});
   // Do not accept moduleKeys from pricing requests: only pricing fields may change.
   const updated=await tx.subscriptionPlan.update({where:{id},data:{currency,monthlyPrice:monthlyPrice.toFixed(2),annualPrice:annualPrice.toFixed(2)}});
   await tx.auditLog.create({data:{actorId:u.id,action:'SUBSCRIPTION_PLAN_PRICING_UPDATED',entity:'SubscriptionPlan',entityId:id,detail:{name:existing.name,currency,monthlyPrice,annualPrice}}});
   return updated;
  });
  return NextResponse.json({plan:{...plan,monthlyPrice:Number(plan.monthlyPrice),annualPrice:Number(plan.annualPrice)}});
 }catch(e:any){if(e?.code==='P2025')return NextResponse.json({error:'Plan not found'},{status:404});return NextResponse.json({error:'Unable to update pricing'},{status:500})}
}
