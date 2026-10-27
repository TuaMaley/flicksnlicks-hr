import {NextRequest} from 'next/server';
import {db} from '../../../../../lib/db';
import {access,employeeWhere} from '../../../../../lib/auth';
import {fail,ok} from '../../../../../lib/http';

type Ctx={params:Promise<{id:string}>};
const valid=['PRESENT','ABSENT','LATE','EXCUSED'] as const;
const day=(s:unknown)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?new Date(s+'T00:00:00.000Z'):null;

export async function GET(req:NextRequest,{params}:Ctx){
 try{
  const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.view'))return fail('Forbidden',403);
  const {id}=await params;
  const training=await db.training.findUnique({where:{id},select:{id:true,title:true,startDate:true,endDate:true}});
  if(!training)return fail('Training not found',404);
  const enrollments=await db.trainingEnrollment.findMany({where:{trainingId:id,status:{not:'WITHDRAWN'},employee:employeeWhere(a)},select:{id:true,employeeId:true,employee:{select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,branch:{select:{name:true}}}}},orderBy:{enrolledAt:'asc'}});
  const sessions=await db.trainingAttendanceSession.findMany({where:{trainingId:id},include:{records:{where:{employeeId:{in:enrollments.map(x=>x.employeeId)}},select:{id:true,enrollmentId:true,employeeId:true,status:true,markedAt:true}}},orderBy:{sessionDate:'desc'},take:200});
  return ok({training,enrollments,sessions});
 }catch(e){console.error('Attendance GET failed',e);return fail('Unable to load attendance',500)}
}

export async function POST(req:NextRequest,{params}:Ctx){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('training.edit'))return fail('Forbidden',403);
 const {id}=await params;
 let body:any;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 const sessionDate=day(body?.sessionDate);
 if(!sessionDate)return fail('Valid session date (YYYY-MM-DD) is required',400);
 const entries=body?.entries;
 if(!Array.isArray(entries)||entries.length===0||entries.length>500||entries.some((x:any)=>!x||typeof x.enrollmentId!=='string'||!valid.includes(x.status)))return fail('Provide 1–500 valid attendance entries',400);
 const ids=entries.map((x:any)=>x.enrollmentId as string);
 if(new Set(ids).size!==ids.length)return fail('Duplicate enrollment IDs are not allowed',400);
 try{
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
   const training=await tx.training.findUnique({where:{id},select:{id:true,status:true}});
   if(!training)throw Error('Training not found');
   if(training.status==='CANCELLED')throw Error('Cannot mark attendance for cancelled training');
   const enrolled=await tx.trainingEnrollment.findMany({where:{id:{in:ids},trainingId:id,status:{not:'WITHDRAWN'},employee:employeeWhere(a)},select:{id:true,employeeId:true}});
   if(enrolled.length!==ids.length)throw Error('Some participants are not eligible or outside your authorized scope');
   const session=await tx.trainingAttendanceSession.upsert({where:{trainingId_sessionDate:{trainingId:id,sessionDate}},create:{trainingId:id,sessionDate,createdById:a.user!.id},update:{}});
   const byId=new Map(enrolled.map(x=>[x.id,x.employeeId]));
   for(const entry of entries){
    await tx.trainingAttendance.upsert({where:{sessionId_enrollmentId:{sessionId:session.id,enrollmentId:entry.enrollmentId}},create:{sessionId:session.id,enrollmentId:entry.enrollmentId,employeeId:byId.get(entry.enrollmentId)!,status:entry.status,markedById:a.user!.id},update:{status:entry.status,markedById:a.user!.id,markedAt:new Date()}});
   }
   await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_ATTENDANCE_MARKED',entity:'Training',entityId:id,detail:{sessionDate:body.sessionDate,count:entries.length,employeeIds:enrolled.map(x=>x.employeeId)}}});
   return {saved:entries.length};
  });return ok(result);
 }catch(e:any){if(['Training not found','Cannot mark attendance for cancelled training','Some participants are not eligible or outside your authorized scope'].includes(e?.message))return fail(e.message,400);console.error('Attendance POST failed',e);return fail('Unable to save attendance',500)}
}
