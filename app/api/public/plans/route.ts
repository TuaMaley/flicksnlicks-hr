import {NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {MODULE_LABELS,PUBLIC_MODULE_KEYS} from '../../../../lib/onboarding/constants';
import {showPublicPrices} from '../../../_site/plans';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Public pricing: active plans with at least one module. No tenant data. */
export async function GET(){
 try{
  const plans=await db.subscriptionPlan.findMany({where:{active:true},orderBy:[{monthlyPrice:'asc'},{name:'asc'}],select:{id:true,name:true,monthlyPrice:true,annualPrice:true,currency:true,moduleKeys:true}});
  return NextResponse.json({plans:plans.map(p=>{
   const keys=Array.isArray(p.moduleKeys)?p.moduleKeys.filter((k):k is string=>typeof k==='string'):[];
   const modules=(PUBLIC_MODULE_KEYS as readonly string[]).filter(k=>keys.includes(k));
   const show=showPublicPrices();
   return {id:p.id,name:p.name,monthlyPrice:show?Number(p.monthlyPrice):0,annualPrice:show?Number(p.annualPrice):0,currency:p.currency,modules:modules.map(k=>({key:k,label:MODULE_LABELS[k]}))};
  }).filter(p=>p.modules.length>0).sort((a,b)=>a.modules.length-b.modules.length||a.name.localeCompare(b.name))},{headers:{'Cache-Control':'public, max-age=60, s-maxage=60'}});
 }catch(e){console.error('Public plans failed',e);return NextResponse.json({plans:[],error:'Pricing is temporarily unavailable'},{status:503})}
}
