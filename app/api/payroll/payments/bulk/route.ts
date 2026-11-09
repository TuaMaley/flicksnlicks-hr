import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const dynamic='force-dynamic';
const respond=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
type Entry={id:string;reference?:string};
export async function POST(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return respond({error:'Unauthorized'},401);
  if(!a.companyId||!a.can('payroll.finance_approve'))return respond({error:'Company Finance approval permission required'},403);
  const body=await req.json();const action=body.action;
  if(action!=='VERIFY'&&action!=='CONFIRM_PAID')return respond({error:'Invalid bulk action'},400);
  const rows:Entry[]=body.rows;
  if(!Array.isArray(rows)||rows.length<1||rows.length>100||rows.some(r=>!r||typeof r.id!=='string'||!r.id))return respond({error:'Select between 1 and 100 payment records'},400);
  if(new Set(rows.map(r=>r.id)).size!==rows.length)return respond({error:'Duplicate payment selection'},400);
  if(action==='CONFIRM_PAID'){
   if(rows.some(r=>typeof r.reference!=='string'||r.reference.trim().length<5||r.reference.trim().length>120))return respond({error:'Each payment needs its own external transaction reference (5–120 characters)'},400);
   if(new Set(rows.map(r=>r.reference!.trim())).size!==rows.length)return respond({error:'Each payment must have a distinct external transaction reference'},400);
  }
  const result=await db.$transaction(async tx=>{
   const payments=await tx.payrollPayment.findMany({where:{companyId:a.companyId!,id:{in:rows.map(r=>r.id)}}});
   if(payments.length!==rows.length)return {error:'Some payments are not in your active company',status:403};
   const byId=new Map(payments.map(p=>[p.id,p]));
   for(const r of rows){const p=byId.get(r.id)!;
    if(action==='VERIFY'){
     if(p.status!=='PENDING'||!p.recipientName||!p.paymentDestination)return {error:`${p.employeeName}: payment must be pending with recipient and destination recorded`,status:409};
     if(p.preparedById===a.user!.id)return {error:`${p.employeeName}: preparer cannot verify their own payment`,status:403};
    }else{
     if(p.status!=='VERIFIED')return {error:`${p.employeeName}: payment must be verified before confirmation`,status:409};
     if(p.preparedById===a.user!.id||p.verifiedById===a.user!.id)return {error:`${p.employeeName}: confirmation requires an independent Finance user`,status:403};
     const existing=await tx.payrollPayment.count({where:{status:'PAID',reference:r.reference!.trim()}});
     if(existing)return {error:`${p.employeeName}: transaction reference already used`,status:409};
    }
   }
   for(const r of rows){const p=byId.get(r.id)!;const next=action==='VERIFY'?'VERIFIED':'PAID';
    const updated=await tx.payrollPayment.updateMany({where:{id:r.id,companyId:a.companyId!,status:p.status},data:action==='VERIFY'?{status:next,verifiedById:a.user!.id,verifiedAt:new Date()}:{status:next,confirmedById:a.user!.id,confirmedAt:new Date(),reference:r.reference!.trim()}});
    if(updated.count!==1)throw new Error('Concurrent payment change; no bulk changes committed');
    await tx.payrollPaymentEvent.create({data:{companyId:a.companyId!,paymentId:r.id,actorId:a.user!.id,action:action==='VERIFY'?'VERIFY':'CONFIRM_PAID',fromStatus:p.status,toStatus:next,detail:{bulk:true,...(action==='CONFIRM_PAID'?{reference:r.reference!.trim()}: {})}}});
   }
   return {success:true,processed:rows.length,action};
  },{timeout:30000});
  if('error'in result)return respond(result,result.status);
  return respond(result);
 }catch(e){console.error('[payroll bulk]',e);return respond({error:'Bulk action failed; no payments were changed. Review server logs.'},500)}
}
