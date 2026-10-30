import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {securityAdmin} from '../../../../lib/accessSecurity';
export async function GET(){
 const auth=await securityAdmin();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const reviews=await db.accessReview.findMany({orderBy:{createdAt:'desc'},take:100});
 const ids=[...new Set(reviews.flatMap(r=>[r.userId,r.reviewerId]))];
 const users=await db.user.findMany({where:{id:{in:ids}},select:{id:true,name:true,email:true,active:true,roles:{include:{role:{select:{name:true}}}}}});
 const byId=new Map(users.map(x=>[x.id,x]));
 return NextResponse.json({users:users.map(u=>({id:u.id,name:u.name,email:u.email,active:u.active})),reviews:reviews.map(r=>({...r,subject:byId.get(r.userId)||null,reviewer:byId.get(r.reviewerId)||null}))});
}
export async function POST(req:NextRequest){
 const auth=await securityAdmin();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await req.json().catch(()=>null);
 const userId=typeof body?.userId==='string'?body.userId:'';
 const dueDate=typeof body?.dueDate==='string'?new Date(body.dueDate):null;
 if(!userId||!dueDate||Number.isNaN(dueDate.getTime())||dueDate.getTime()<Date.now())return NextResponse.json({error:'Select a user and a future due date'},{status:400});
 const subject=await db.user.findUnique({where:{id:userId},select:{id:true}});
 if(!subject)return NextResponse.json({error:'User not found'},{status:404});
 const open=await db.accessReview.findFirst({where:{userId,status:'OPEN'}});
 if(open)return NextResponse.json({error:'An open review already exists for this user'},{status:409});
 const review=await db.$transaction(async tx=>{
  const r=await tx.accessReview.create({data:{userId,reviewerId:auth.user.id,dueDate}});
  await tx.auditLog.create({data:{actorId:auth.user.id,action:'ACCESS_REVIEW_CREATED',entity:'AccessReview',entityId:r.id,detail:{userId,dueDate:dueDate.toISOString()}}});
  return r;
 });
 return NextResponse.json({review},{status:201});
}
export async function PATCH(req:NextRequest){
 const auth=await securityAdmin();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await req.json().catch(()=>null);
 if(typeof body?.id!=='string'||!['APPROVED','FLAGGED'].includes(body?.decision)||typeof body?.notes!=='string'||body.notes.trim().length<5)return NextResponse.json({error:'Review ID, decision and notes (5+ characters) required'},{status:400});
 const review=await db.$transaction(async tx=>{
  const result=await tx.accessReview.updateMany({where:{id:body.id,status:'OPEN'},data:{status:body.decision,notes:body.notes.trim().slice(0,2000),completedAt:new Date(),reviewerId:auth.user.id}});
  if(!result.count)return null;
  await tx.auditLog.create({data:{actorId:auth.user.id,action:'ACCESS_REVIEW_'+body.decision,entity:'AccessReview',entityId:body.id,detail:{notes:body.notes.trim().slice(0,2000)}}});
  return tx.accessReview.findUnique({where:{id:body.id}});
 });
 if(!review)return NextResponse.json({error:'Review not found or already completed'},{status:409});
 return NextResponse.json({review});
}
