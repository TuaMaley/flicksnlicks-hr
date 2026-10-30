import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
const categories=['GENERAL','DOCUMENT','EMPLOYMENT_VERIFICATION','PAYROLL','OTHER'];
export async function GET(){
 try{const a=await access();if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});if(!a.user.employeeId)return NextResponse.json({error:'Your account is not linked to an employee record'},{status:403});
 const requests=await db.employeeHRRequest.findMany({where:{employeeId:a.user.employeeId},select:{id:true,category:true,subject:true,details:true,status:true,response:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'},take:100});
 return NextResponse.json({requests},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('ESS requests GET',e);return NextResponse.json({error:'Unable to load requests'},{status:500})}}
export async function POST(req:Request){
 try{const a=await access();if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});if(!a.can('selfservice.edit'))return NextResponse.json({error:'Forbidden'},{status:403});if(!a.user.employeeId)return NextResponse.json({error:'Your account is not linked to an employee record'},{status:403});
 const body=await req.json().catch(()=>null);if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid request body'},{status:400});
 const category=typeof body.category==='string'?body.category:'';
 const subject=typeof body.subject==='string'?body.subject.trim():'';
 const details=typeof body.details==='string'?body.details.trim():'';
 if(!categories.includes(category)||subject.length<3||subject.length>160||details.length<10||details.length>4000)return NextResponse.json({error:'Select a valid category, enter a subject (3–160 characters) and details (10–4000 characters)'},{status:400});
 const created=await db.$transaction(async tx=>{
 const row=await tx.employeeHRRequest.create({data:{employeeId:a.user!.employeeId!,category,subject,details}});
 await tx.auditLog.create({data:{actorId:a.user!.id,action:'ESS_HR_REQUEST_CREATED',entity:'EmployeeHRRequest',entityId:row.id,detail:{category}}});
 return row;
 });
 return NextResponse.json({request:{id:created.id,status:created.status}},{status:201});
 }catch(e){console.error('ESS requests POST',e);return NextResponse.json({error:'Unable to submit request'},{status:500})}}
