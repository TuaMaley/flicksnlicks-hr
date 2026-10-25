import {NextRequest,NextResponse} from 'next/server';
import {access,employeeWhere} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const roles=a.user.roles.filter(r=>r.role.active).map(r=>r.role.name);
 const manager=roles.some(r=>['Administrator','HR Manager','Branch Manager'].includes(r));
 if(!manager)return NextResponse.json({error:'Manager role required'},{status:403});
 const {id}=await params;const row=await db.payrollAttendance.findFirst({where:{id,employee:employeeWhere(a)}});
 if(!row)return NextResponse.json({error:'Record not found within your scope'},{status:404});
 const d=await req.json();const action=d.action;
 if(action==='submit'&&row.status==='DRAFT'){
 const updated=await db.payrollAttendance.updateMany({where:{id,status:'DRAFT'},data:{status:'SUBMITTED'}});
 return NextResponse.json({updated:updated.count});
 }
 if(['approve','reject'].includes(action)&&row.status==='SUBMITTED'){
 if(!roles.some(r=>['Administrator','HR Manager'].includes(r)))return NextResponse.json({error:'HR or Administrator approval required'},{status:403});
 if(row.submittedById===a.user.id)return NextResponse.json({error:'You cannot approve or reject your own submission'},{status:403});
 const note=String(d.note||'').trim();if(action==='reject'&&note.length<10)return NextResponse.json({error:'Rejection reason must be at least 10 characters'},{status:400});
 const updated=await db.payrollAttendance.updateMany({where:{id,status:'SUBMITTED'},data:{status:action==='approve'?'APPROVED':'REJECTED',reviewedById:a.user.id,reviewedAt:new Date(),reviewNote:note.slice(0,500)}});
 return NextResponse.json({updated:updated.count});
 }
 return NextResponse.json({error:'Action not allowed in current status'},{status:409});
}
