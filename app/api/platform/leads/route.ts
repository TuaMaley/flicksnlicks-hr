import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {LEAD_STATUSES} from '../../../../lib/onboarding/constants';
import {cleanMultiline} from '../../../../lib/onboarding/security';
export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store'};
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{id:true,active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?a:null}
export async function GET(req:NextRequest){
 if(!await guard())return NextResponse.json({error:'Platform administrator required'},{status:403});
 const kind=req.nextUrl.searchParams.get('kind'),status=req.nextUrl.searchParams.get('status');
 const where:any={};if(kind==='DEMO'||kind==='CONTACT')where.kind=kind;if(status&&(LEAD_STATUSES as readonly string[]).includes(status))where.status=status;
 const [leads,grouped]=await Promise.all([
  db.websiteLead.findMany({where,orderBy:{createdAt:'desc'},take:300,select:{id:true,kind:true,status:true,name:true,email:true,phone:true,companyName:true,jobTitle:true,country:true,employeeBand:true,topic:true,message:true,preferredTime:true,internalNote:true,createdAt:true,updatedAt:true}}),
  db.websiteLead.groupBy({by:['kind','status'],_count:{_all:true}}),
 ]);
 return NextResponse.json({leads,counts:grouped.map(g=>({kind:g.kind,status:g.status,count:g._count._all}))},{headers:noStore});
}
export async function POST(req:NextRequest){
 const actor=await guard();if(!actor)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 const id=typeof b?.id==='string'?b.id:'';const status=typeof b?.status==='string'?b.status:'';
 if(!id||!(LEAD_STATUSES as readonly string[]).includes(status))return NextResponse.json({error:'Choose a valid status'},{status:400,headers:noStore});
 const internalNote=cleanMultiline(b?.internalNote,1000)||null;
 const before=await db.websiteLead.findUnique({where:{id},select:{status:true}});
 if(!before)return NextResponse.json({error:'Lead not found'},{status:404,headers:noStore});
 await db.$transaction([
  db.websiteLead.update({where:{id},data:{status,internalNote,handledById:actor.id}}),
  db.auditLog.create({data:{actorId:actor.id,action:'WEBSITE_LEAD_UPDATED',entity:'WebsiteLead',entityId:id,detail:{from:before.status,to:status,note:internalNote}}}),
 ]);
 return NextResponse.json({message:'Lead updated'},{headers:noStore});
}
