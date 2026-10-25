import {NextRequest,NextResponse} from 'next/server';
import {access,employeeWhere} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
const manager=(a:Awaited<ReturnType<typeof access>>)=>Boolean(a.user?.roles.some(r=>r.role.active&&['Administrator','HR Manager','Branch Manager'].includes(r.role.name)));
export async function GET(req:NextRequest){
 try{
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!manager(a)&&!a.can('employees.view'))return NextResponse.json({error:'Attendance access required'},{status:403});
 const month=req.nextUrl.searchParams.get('month')||new Date().toISOString().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'Invalid month'},{status:400});
 const start=new Date(month+'-01T00:00:00.000Z');const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1));
 const where=employeeWhere(a);
 const [employees,records]=await Promise.all([
 db.employee.findMany({where,select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,branch:{select:{name:true}}},orderBy:{firstName:'asc'},take:1000}),
 db.payrollAttendance.findMany({where:{employee:where,workDate:{gte:start,lt:end}},orderBy:[{workDate:'desc'},{createdAt:'desc'}],take:2000})]);
 return NextResponse.json({employees,records},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[attendance GET]',e);return NextResponse.json({error:'Attendance could not be loaded. Verify that the PayrollAttendance database table exists.'},{status:500})}
}
export async function POST(req:NextRequest){
 try{
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!manager(a))return NextResponse.json({error:'Manager role required'},{status:403});
 const d=await req.json();if(typeof d.employeeId!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.workDate||''))return NextResponse.json({error:'Employee and date are required'},{status:400});
 const employee=await db.employee.findFirst({where:{AND:[employeeWhere(a),{id:d.employeeId}]}});if(!employee)return NextResponse.json({error:'Employee outside your scope'},{status:403});
 const workDate=new Date(d.workDate+'T00:00:00.000Z');if(Number.isNaN(workDate.getTime())||workDate.toISOString().slice(0,10)!==d.workDate)return NextResponse.json({error:'Invalid date'},{status:400});
 const validTime=(v:any)=>v===''||v==null||typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!validTime(d.clockIn)||!validTime(d.clockOut))return NextResponse.json({error:'Use HH:MM for clock times'},{status:400});
 const toMin=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
 const start=d.clockIn||'',end=d.clockOut||'';
 if(Boolean(start)!==Boolean(end))return NextResponse.json({error:'Both clock-in and clock-out are required'},{status:400});
 const breaks=Number(d.breakMinutes||0);if(!Number.isInteger(breaks)||breaks<0||breaks>720)return NextResponse.json({error:'Invalid break duration'},{status:400});
 let worked=0;if(start&&end){worked=toMin(end)-toMin(start);if(worked<0)worked+=1440;worked-=breaks;if(worked<0||worked>1440)return NextResponse.json({error:'Invalid worked duration'},{status:400})}
 const regularMinutes=Math.min(worked,480),overtimeMinutes=Math.max(0,worked-480);
 const existing=await db.payrollAttendance.findUnique({where:{employeeId_workDate:{employeeId:employee.id,workDate}}});
 if(existing&&existing.status!=='DRAFT'&&existing.status!=='REJECTED')return NextResponse.json({error:'Submitted or approved attendance cannot be overwritten'},{status:409});
 const payload={clockIn:start||null,clockOut:end||null,breakMinutes:breaks,regularMinutes,overtimeMinutes,notes:String(d.notes||'').slice(0,500),status:'DRAFT' as const,submittedById:a.user.id,reviewedById:null,reviewedAt:null,reviewNote:null};
 const record=existing?await db.payrollAttendance.update({where:{id:existing.id},data:payload}):await db.payrollAttendance.create({data:{employeeId:employee.id,workDate,...payload}});
 return NextResponse.json({record},{status:existing?200:201});
 }catch(e){console.error('[attendance POST]',e);return NextResponse.json({error:'Could not save attendance'},{status:500})}
}
