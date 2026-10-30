import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const dynamic='force-dynamic';
type Action='submit'|'hr_approve'|'finance_approve'|'reject';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});if(!a.companyId)return NextResponse.json({error:'Select an authorized company'},{status:403});
  const {id}=await params;const body=await req.json();const action:Action=body.action;
  if(!['submit','hr_approve','finance_approve','reject'].includes(action))return NextResponse.json({error:'Invalid action'},{status:400});
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(action==='reject'&&(reason.length<10||reason.length>1000))return NextResponse.json({error:'Rejection reason must be 10–1000 characters'},{status:400});
  const names=a.user.roles.filter(r=>r.role.active).map(r=>r.role.name);
  const isHR=names.some(n=>['HR Manager','Administrator'].includes(n));
  const isFinance=names.some(n=>['Finance','Finance Officer','Finance Manager','Administrator'].includes(n));
  const result=await db.$transaction(async tx=>{
   const batch=await tx.payrollCalculationBatch.findUnique({where:{id},include:{approvals:{orderBy:{createdAt:'asc'}}}});
   if(!batch||batch.companyId!==a.companyId)return {error:'Payroll batch not found',status:404};
   const state=batch.status;
   const rules:Record<Action,{from:string;to:string;role:boolean}>={
    submit:{from:'DRAFT',to:'HR_REVIEW',role:isHR},
    hr_approve:{from:'HR_REVIEW',to:'FINANCE_REVIEW',role:isHR},
    finance_approve:{from:'FINANCE_REVIEW',to:'APPROVED',role:isFinance},
    reject:{from:state,to:'REJECTED',role:state==='HR_REVIEW'?isHR:state==='FINANCE_REVIEW'?isFinance:false}
   };
   const rule=rules[action];if(!rule.role)return {error:'You do not have permission for this approval stage',status:403};
   if(state!==rule.from||state==='REJECTED'||state==='APPROVED')return {error:'Invalid or completed workflow stage',status:409};
   if(action==='reject'&&!['HR_REVIEW','FINANCE_REVIEW'].includes(state))return {error:'Only an active reviewer can reject',status:409};
   if(action!=='submit'){
    if(batch.createdById===a.user!.id)return {error:'The payroll creator cannot review or approve their own batch',status:403};
    const priorHR=batch.approvals.find(e=>e.action==='hr_approve');
    if(state==='FINANCE_REVIEW'&&priorHR?.actorId===a.user!.id)return {error:'Finance approval must be performed by someone other than the HR reviewer',status:403};
   }
   const changed=await tx.payrollCalculationBatch.updateMany({where:{id,companyId:a.companyId,status:state},data:{status:rule.to}});
   if(changed.count!==1)return {error:'Batch changed during review; refresh and try again',status:409};
   await tx.payrollApprovalEvent.create({data:{companyId:a.companyId,batchId:id,actorId:a.user!.id,action,fromStatus:state,toStatus:rule.to,reason:reason||null}});
   return {status:200,success:true,newStatus:rule.to};
  });
  if('error' in result)return NextResponse.json({error:result.error},{status:result.status});
  return NextResponse.json(result);
 }catch(e){console.error('[payroll approvals PATCH]',e);return NextResponse.json({error:'Could not update payroll approval. Check server logs.'},{status:500})}
}
