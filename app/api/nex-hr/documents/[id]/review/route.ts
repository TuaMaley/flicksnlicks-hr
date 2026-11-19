import {NextRequest} from 'next/server';
import {db} from '../../../../../../lib/db';
import {fail,ok} from '../../../../../../lib/http';
import {gate,log} from '../../../../../../lib/nexhr';
import {notifyApprovedNexHrPolicy} from '../../../../../../lib/nexhr-policy-notifications';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {a,error}=await gate('nexhr.approve');if(error)return error;
 const {id}=await params;let input:any;
 try{input=await req.json()}catch{return fail('Invalid JSON',400)}
 const decision=String(input?.decision||'');const reason=String(input?.reason||'').trim().slice(0,2000);
 if(!['APPROVED','REJECTED'].includes(decision))return fail('Invalid decision',400);
 if(decision==='REJECTED'&&!reason)return fail('Rejection reason is required',400);
 const doc=await db.nexHrDocument.findFirst({where:{id,companyId:a.companyId!}});
 if(!doc)return fail('Document not found',404);
 if(doc.status!=='PENDING')return fail('Only pending documents can be reviewed',409);
 if(doc.uploadedById===a.user!.id)return fail('Uploader cannot approve or reject their own document',403);
 try{
 await db.$transaction(async tx=>{
 const changed=await tx.nexHrDocument.updateMany({where:{id,companyId:a.companyId!,status:'PENDING'},data:{status:decision,reviewReason:reason||null,reviewedById:a.user!.id,reviewedAt:new Date()}});
 if(changed.count!==1)throw Error('Document was already reviewed');
 if(decision==='APPROVED')await tx.nexHrDocument.updateMany({where:{companyId:a.companyId!,familyId:doc.familyId,status:'APPROVED',id:{not:id}},data:{status:'SUPERSEDED'}});
 });
 await log(a.companyId!,id,a.user!.id,decision,{reason});
 if(decision==='APPROVED'&&doc.visibility==='ALL_EMPLOYEES') {
  // Notification failure must never roll back an already-approved policy.
  try { await notifyApprovedNexHrPolicy({companyId:a.companyId!,documentId:id,title:doc.title,version:doc.version,actorId:a.user!.id,effectiveAt:doc.effectiveAt,expiresAt:doc.expiresAt}); }
  catch(e){console.error('Nex HR policy notification failed',e)}
 }
 return ok({status:decision});
 }catch{return fail('Document changed; refresh',409)}
}
