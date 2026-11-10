import {db} from '../../lib/db';
import {MODULE_LABELS,PUBLIC_MODULE_KEYS} from '../../lib/onboarding/constants';
export type PublicPlan={id:string;name:string;monthlyPrice:number;annualPrice:number;currency:string;modules:string[]};
/** Active plans for the public site. Returns [] (never throws) so pages still render if the DB is unavailable. */
export async function publicPlans():Promise<PublicPlan[]>{
 try{
  const plans=await db.subscriptionPlan.findMany({where:{active:true},orderBy:[{monthlyPrice:'asc'},{name:'asc'}],select:{id:true,name:true,monthlyPrice:true,annualPrice:true,currency:true,moduleKeys:true}});
  return plans.map(p=>{const keys=Array.isArray(p.moduleKeys)?p.moduleKeys.filter((k):k is string=>typeof k==='string'):[];return {id:p.id,name:p.name,monthlyPrice:Number(p.monthlyPrice),annualPrice:Number(p.annualPrice),currency:p.currency,modules:(PUBLIC_MODULE_KEYS as readonly string[]).filter(k=>keys.includes(k))}}).filter(p=>p.modules.length>0);
 }catch(e){console.error('Public plans unavailable',e);return []}
}
export const moduleLabel=(k:string)=>MODULE_LABELS[k]||k;
export const PUBLIC_KEYS=PUBLIC_MODULE_KEYS as readonly string[];
export function formatPrice(amount:number,currency:string){const sym=currency==='GHS'?'GH₵':currency==='USD'?'$':currency+' ';return sym+amount.toLocaleString('en-GH',{minimumFractionDigits:amount%1?2:0,maximumFractionDigits:2})}
