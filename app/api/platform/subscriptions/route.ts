import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
async function guard(){
 const u=await currentUser();
 if(!u)return null;
 const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});
 return a?.active&&a.platformAdmin?u:null;
}
export async function GET(){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const [companies,subscriptions]=await Promise.all([
  db.company.findMany({select:{id:true,name:true,active:true},orderBy:{name:'asc'}}),
  db.platformSubscription.findMany({include:{company:{select:{name:true}}},orderBy:{createdAt:'desc'}})
 ]);
 return NextResponse.json({companies,subscriptions},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const planName=typeof b?.planName==='string'?b.planName.trim():'';
 const notes=typeof b?.notes==='string'?b.notes.trim().slice(0,500):'';
 const startsAt=new Date(b?.startsAt),endsAt=new Date(b?.endsAt);
 if(!companyId||planName.length<2||planName.length>80||!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)
  return NextResponse.json({error:'Company, plan and valid start/end dates required'},{status:400});
 const company=await db.company.findUnique({where:{id:companyId}});
 if(!company)return NextResponse.json({error:'Company not found'},{status:404});
 const existing=await db.platformSubscription.findFirst({where:{companyId,status:'ACTIVE',startsAt:{lt:endsAt},endsAt:{gt:startsAt}}});
 if(existing)return NextResponse.json({error:'An active subscription overlaps this period. End it before creating another.'},{status:409});
 const result=await db.$transaction(async tx=>{
  const s=await tx.platformSubscription.create({data:{companyId,planName,startsAt,endsAt,notes:notes||null}});
  await tx.auditLog.create({data:{actorId:u.id,companyId,action:'PLATFORM_SUBSCRIPTION_CREATED',entity:'PlatformSubscription',entityId:s.id,detail:{planName,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()}}});
  return s;
 });
 return NextResponse.json({subscription:result},{status:201});
}
export async function PATCH(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 if(typeof b?.id!=='string'||!['ACTIVE','CANCELLED'].includes(b?.status)||typeof b?.reason!=='string'||b.reason.trim().length<8)
  return NextResponse.json({error:'Subscription, status and reason (8+ characters) required'},{status:400});
 const current=await db.platformSubscription.findUnique({where:{id:b.id}});
 if(!current)return NextResponse.json({error:'Subscription not found'},{status:404});
 if(current.status===b.status)return NextResponse.json({error:'Already in requested status'},{status:409});
 if(b.status==='ACTIVE'){
  const conflict=await db.platformSubscription.findFirst({where:{companyId:current.companyId,id:{not:current.id},status:'ACTIVE',startsAt:{lt:current.endsAt},endsAt:{gt:current.startsAt}}});
  if(conflict)return NextResponse.json({error:'Overlapping active subscription'},{status:409});
 }
 await db.$transaction(async tx=>{
  await tx.platformSubscription.update({where:{id:current.id},data:{status:b.status}});
  await tx.auditLog.create({data:{actorId:u.id,companyId:current.companyId,action:'PLATFORM_SUBSCRIPTION_STATUS_CHANGED',entity:'PlatformSubscription',entityId:current.id,detail:{from:current.status,to:b.status,reason:b.reason.trim().slice(0,500)}}});
 });
 return NextResponse.json({success:true});
}
