import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return fail('Unauthorized',401);
  if(!a.can('training.view')||!a.can('training.edit'))return fail('Forbidden',403);
  const q=req.nextUrl.searchParams;
  const branch=q.get('branch')||'', department=q.get('department')||'', category=q.get('category')||'';
  const from=q.get('from')||'',to=q.get('to')||'';
  const validDate=(v:string)=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
  if(!validDate(from)||!validDate(to)||from&&to&&from>to)return fail('Invalid date range',400);
  const scope=employeeWhere(a);
  const employeeFilter:any={AND:[scope]};
  if(branch)employeeFilter.AND.push({branch:{name:branch}});
  if(department)employeeFilter.AND.push({department});
  const trainingWhere:any={};
  if(category)trainingWhere.category=category;
  if(from||to)trainingWhere.startDate={...(from?{gte:new Date(from+'T00:00:00.000Z')}:{}),...(to?{lte:new Date(to+'T23:59:59.999Z')}:{})};
  const trainings=await db.training.findMany({where:trainingWhere,select:{id:true,title:true,category:true,status:true,trainer:true,startDate:true,estimatedCost:true},orderBy:{startDate:'desc'}});
  const ids=trainings.map(t=>t.id);
  const enrollments=await db.trainingEnrollment.findMany({where:{trainingId:{in:ids},employee:employeeFilter},select:{id:true,trainingId:true,employeeId:true,status:true,employee:{select:{department:true,branch:{select:{name:true}}}}}});
  const enrollmentIds=enrollments.map(e=>e.id);
  const attendance=await db.trainingAttendance.findMany({where:{enrollmentId:{in:enrollmentIds}},select:{enrollmentId:true,status:true,session:{select:{trainingId:true,sessionDate:true}}}});
  const responses=await db.trainingEvaluationResponse.findMany({where:{enrollmentId:{in:enrollmentIds},trainingId:{in:ids}},select:{trainingId:true,enrollmentId:true,answers:{select:{rating:true,question:{select:{category:true}}}}}});
  const scopedTrainings=trainings.filter(t=>enrollments.some(e=>e.trainingId===t.id));
  const grouped=new Map<string,{name:string;enrollments:number;completed:number}>();
  const add=(name:string,completed:boolean)=>{const x=grouped.get(name)||{name,enrollments:0,completed:0};x.enrollments++;if(completed)x.completed++;grouped.set(name,x)};
  const branches=new Map<string,{name:string;enrollments:number;completed:number}>();
  for(const e of enrollments){const name=e.employee.branch.name;const x=branches.get(name)||{name,enrollments:0,completed:0};x.enrollments++;if(e.status==='COMPLETED')x.completed++;branches.set(name,x);add(e.employee.department||'Unassigned',e.status==='COMPLETED')}
  const ratings=responses.flatMap(r=>r.answers.filter(x=>x.rating!==null).map(x=>x.rating as number));
  const trainerRatings=responses.flatMap(r=>r.answers.filter(x=>x.rating!==null&&x.question.category==='TRAINER').map(x=>x.rating as number));
  const avg=(xs:number[])=>xs.length?Math.round(xs.reduce((s,n)=>s+n,0)/xs.length*100)/100:null;
  const byProgram=scopedTrainings.map(t=>{const es=enrollments.filter(e=>e.trainingId===t.id);const rs=responses.filter(r=>r.trainingId===t.id);const at=attendance.filter(x=>x.session.trainingId===t.id);return {id:t.id,title:t.title,category:t.category,status:t.status,trainer:t.trainer,startDate:t.startDate,estimatedCost:t.estimatedCost?.toString()??null,enrolled:es.filter(e=>e.status!=='WITHDRAWN').length,completed:es.filter(e=>e.status==='COMPLETED').length,responses:rs.length,attendanceRecords:at.length,present:at.filter(x=>x.status==='PRESENT').length,late:at.filter(x=>x.status==='LATE').length,absent:at.filter(x=>x.status==='ABSENT').length,excused:at.filter(x=>x.status==='EXCUSED').length,averageRating:avg(rs.flatMap(r=>r.answers.filter(x=>x.rating!==null).map(x=>x.rating as number)))}});
  const active=enrollments.filter(e=>e.status!=='WITHDRAWN');
  const marked=attendance.length;
  return ok({summary:{programs:scopedTrainings.length,completedPrograms:scopedTrainings.filter(t=>t.status==='COMPLETED').length,enrollments:active.length,uniqueEmployees:new Set(active.map(e=>e.employeeId)).size,completedEnrollments:active.filter(e=>e.status==='COMPLETED').length,attendanceRecords:marked,present:attendance.filter(x=>x.status==='PRESENT').length,late:attendance.filter(x=>x.status==='LATE').length,absent:attendance.filter(x=>x.status==='ABSENT').length,excused:attendance.filter(x=>x.status==='EXCUSED').length,responses:responses.length,averageRating:avg(ratings),trainerRating:avg(trainerRatings),estimatedCost:scopedTrainings.reduce((s,t)=>s+Number(t.estimatedCost||0),0)},programs:byProgram,branches:[...branches.values()].sort((a,b)=>b.enrollments-a.enrollments),departments:[...grouped.values()].sort((a,b)=>b.enrollments-a.enrollments),filters:{branches:[...new Set(enrollments.map(e=>e.employee.branch.name))].sort(),departments:[...new Set(enrollments.map(e=>e.employee.department))].sort(),categories:[...new Set(trainings.map(t=>t.category).filter(Boolean))].sort()}});
 }catch(e){console.error('Training analytics GET failed',e);return fail('Unable to load training analytics',500)}
}
