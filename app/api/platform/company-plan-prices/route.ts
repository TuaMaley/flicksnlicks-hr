import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
export async function GET(){if(!await guard())return NextResponse.json({error:'Platform administrator required'},{status:403});const prices=await db.companyPlanPrice.findMany({orderBy:{updatedAt:'desc'}});return NextResponse.json({prices:prices.map(p=>({...p,monthlyPrice:Number(p.monthlyPrice),annualPrice:Number(p.annualPrice)}))},{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 const companyId=typeof b?.companyId==='string'?b.companyId.trim():'';
 const planId=typeof b?.planId==='string'?b.planId.trim():'';
 const currency=typeof b?.currency==='string'?b.currency.trim().toUpperCase():'';
 const monthlyPrice=typeof b?.monthlyPrice==='number'?b.monthlyPrice:NaN;
 if(!companyId||!planId||!['GHS','USD'].includes(currency)||!Number.isFinite(monthlyPrice)||monthlyPrice<0||monthlyPrice>999999999||Math.round(monthlyPrice*100)!==monthlyPrice*100 && Math.abs(Math.round(monthlyPrice*100)-monthlyPrice*100)>0.000001)return NextResponse.json({error:'Valid company, plan, currency and monthly price (up to two decimals) required'},{status:400});
 const [company,plan]=await Promise.all([db.company.findUnique({where:{id:companyId},select:{id:true}}),db.subscriptionPlan.findUnique({where:{id:planId},select:{id:true,name:true}})]);
 if(!company||!plan)return NextResponse.json({error:'Company or plan not found'},{status:404});
 const annualPrice=Math.round(monthlyPrice*1200)/100;
 try{const price=await db.$transaction(async tx=>{const saved=await tx.companyPlanPrice.upsert({where:{companyId_planId:{companyId,planId}},create:{companyId,planId,currency,monthlyPrice:monthlyPrice.toFixed(2),annualPrice:annualPrice.toFixed(2)},update:{currency,monthlyPrice:monthlyPrice.toFixed(2),annualPrice:annualPrice.toFixed(2)}});await tx.auditLog.create({data:{actorId:u.id,companyId,action:'COMPANY_PLAN_PRICE_UPDATED',entity:'CompanyPlanPrice',entityId:saved.id,detail:{planId,planName:plan.name,currency,monthlyPrice,annualPrice}}});return saved;});return NextResponse.json({price:{...price,monthlyPrice:Number(price.monthlyPrice),annualPrice:Number(price.annualPrice)}});}catch{return NextResponse.json({error:'Unable to save company pricing'},{status:500});}
}
