import {NextRequest,NextResponse} from 'next/server';
import {compensationAccess,db} from '../helpers';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {a,canEdit,canApprove}=await compensationAccess();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await params;
 const row=await db.employeeCompensation.findUnique({where:{id}});
 if(!row)return NextResponse.json({error:'Not found'},{status:404});
 const d=await req.json();
 if(d.action==='submit'){
  if(!canEdit||row.status!=='DRAFT')return NextResponse.json({error:'Not allowed'},{status:403});
  return NextResponse.json(await db.employeeCompensation.update({where:{id},data:{status:'PENDING_APPROVAL'}}));
 }
 if(d.action==='approve'||d.action==='reject'){
  if(!canApprove||row.status!=='PENDING_APPROVAL'||row.createdById===a.user.id)return NextResponse.json({error:'Approval requires a different authorized Administrator'},{status:403});
  if(d.action==='reject'&&String(d.note||'').trim().length<10)return NextResponse.json({error:'Rejection reason must be at least 10 characters'},{status:400});
  return NextResponse.json(await db.employeeCompensation.update({where:{id},data:{status:d.action==='approve'?'APPROVED':'REJECTED',reviewedById:a.user.id,reviewedAt:new Date(),reviewNote:String(d.note||'').slice(0,1000)}}));
 }
 return NextResponse.json({error:'Unknown action'},{status:400});
}
