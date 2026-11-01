import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';

export async function POST(req:NextRequest){
 const session=await currentUser();
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const actor=await db.user.findUnique({where:{id:session.id},select:{id:true,active:true,platformAdmin:true}});
 if(!actor?.active||!actor.platformAdmin)return NextResponse.json({error:'Platform administrator access required'},{status:403});
 const body=await req.json().catch(()=>null);
 const reviewId=typeof body?.reviewId==='string'?body.reviewId.trim():'';
 const decision=body?.decision;
 const reason=typeof body?.reason==='string'?body.reason.trim():'';
 if(!reviewId||!['APPROVED','FLAGGED','REVOKED'].includes(decision)||reason.length<10||reason.length>2000)return NextResponse.json({error:'Review, valid decision and reason (10–2000 characters) required'},{status:400});
 try{
  const result=await db.$transaction(async tx=>{
   // Serialize decisions on the same review; concurrent requests must not both succeed.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reviewId}))`;
   const review=await tx.accessReview.findUnique({where:{id:reviewId},select:{id:true,userId:true,companyId:true,status:true}});
   if(!review||review.status!=='OPEN')return {error:'Review not found or already completed',status:409};
   if(!review.companyId)return {error:'Review has no company assignment; manual investigation required',status:409};
   const membership=await tx.companyMembership.findUnique({where:{companyId_userId:{companyId:review.companyId,userId:review.userId}},select:{id:true,active:true,user:{select:{platformAdmin:true}}}});
   if(!membership||membership.user.platformAdmin)return {error:'Membership not eligible for this action',status:409};
   if(decision==='REVOKED'){
    if(!membership.active)return {error:'Membership is already inactive',status:409};
    await tx.companyMembership.update({where:{id:membership.id},data:{active:false}});
   }
   await tx.accessReview.update({where:{id:reviewId},data:{status:decision,notes:reason,completedAt:new Date(),reviewerId:actor.id}});
   await tx.auditLog.create({data:{companyId:review.companyId,actorId:actor.id,action:'PLATFORM_ACCESS_REVIEW_'+decision,entity:'AccessReview',entityId:reviewId,detail:{subjectUserId:review.userId,membershipId:membership.id,reason,membershipRevoked:decision==='REVOKED'}}});
   return {ok:true,decision};
  });
  if('error'in result)return NextResponse.json({error:result.error},{status:result.status});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Privileged review decision failed',e);return NextResponse.json({error:'Unable to complete review decision'},{status:500});}
}
