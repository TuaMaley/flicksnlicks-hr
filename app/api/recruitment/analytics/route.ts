import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

function safeCsv(value:unknown){const raw=String(value??'');const guarded=/^[\s]*[=+\-@]/.test(raw)?"'"+raw:raw;return '"'+guarded.replace(/"/g,'""')+'"'}

export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return fail('Unauthorized',401);
  if(!a.can('recruitment.view'))return fail('Forbidden',403);
  const branchScope={branch:{employees:{some:employeeWhere(a)}}};
  const appScope={vacancy:branchScope};
  const [requisitions,vacancies,applications,interviews,offers]=await Promise.all([
   db.recruitmentRequisition.findMany({where:branchScope,select:{id:true,status:true,createdAt:true}}),
   db.recruitmentVacancy.findMany({where:branchScope,select:{id:true,status:true,branchId:true,branch:{select:{name:true}}}}),
   db.recruitmentApplication.findMany({where:appScope,select:{id:true,status:true,createdAt:true,vacancy:{select:{branchId:true}}}}),
   db.recruitmentInterview.findMany({where:{application:appScope},select:{id:true,status:true,scheduledAt:true}}),
   db.recruitmentOffer.findMany({where:{application:appScope},select:{id:true,status:true,employeeId:true,updatedAt:true,application:{select:{vacancy:{select:{branchId:true}}}}}})
  ]);
  const now=new Date();const day=24*60*60*1000;
  const summary={requisitions:requisitions.length,pendingRequisitions:requisitions.filter(r=>r.status.startsWith('PENDING')).length,vacancies:vacancies.length,publishedVacancies:vacancies.filter(v=>v.status==='PUBLISHED').length,applications:applications.length,interviews:interviews.length,completedInterviews:interviews.filter(i=>i.status==='COMPLETED').length,offers:offers.length,acceptedOffers:offers.filter(o=>o.status==='ACCEPTED'||o.status==='HIRED').length,hires:offers.filter(o=>!!o.employeeId).length,conversionRate:applications.length?Math.round(10000*offers.filter(o=>!!o.employeeId).length/applications.length)/100:0};
  const branchMap=new Map<string,{branchId:string;name:string;vacancies:number;applications:number;hires:number}>();
  for(const v of vacancies){let b=branchMap.get(v.branchId);if(!b){b={branchId:v.branchId,name:v.branch.name,vacancies:0,applications:0,hires:0};branchMap.set(v.branchId,b)}b.vacancies++}
  for(const ap of applications){const b=branchMap.get(ap.vacancy.branchId);if(b)b.applications++}
  for(const o of offers){const b=branchMap.get(o.application.vacancy.branchId);if(b&&o.employeeId)b.hires++}
  const stages=Array.from(new Set(['APPLIED','SCREENING','SHORTLISTED','INTERVIEW','REJECTED',...applications.map(ap=>ap.status)])).map(label=>({label,count:applications.filter(ap=>ap.status===label).length}));
  const monthly=Array.from({length:6},(_,idx)=>{const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5+idx,1));const next=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1));return {month:date.toISOString().slice(0,7),applications:applications.filter(ap=>ap.createdAt>=date&&ap.createdAt<next).length,hires:offers.filter(o=>!!o.employeeId&&o.updatedAt>=date&&o.updatedAt<next).length}});
  const alerts=[
   {kind:'REQUISITIONS',message:'Requisitions pending review for over 7 days',count:requisitions.filter(r=>r.status.startsWith('PENDING')&&now.getTime()-r.createdAt.getTime()>7*day).length},
   {kind:'INTERVIEWS',message:'Interviews scheduled within the next 7 days',count:interviews.filter(i=>i.status==='SCHEDULED'&&i.scheduledAt>=now&&i.scheduledAt.getTime()<=now.getTime()+7*day).length},
   {kind:'OFFERS',message:'Offers awaiting approval for over 3 days',count:offers.filter(o=>o.status==='PENDING_APPROVAL'&&now.getTime()-o.updatedAt.getTime()>3*day).length}
  ].filter(x=>x.count>0);
  const report={generatedAt:now.toISOString(),summary,branches:[...branchMap.values()].sort((a,b)=>a.name.localeCompare(b.name)),stages,monthly,alerts};
  if(req.nextUrl.searchParams.get('format')==='csv'){
   const rows:(string|number)[][]=[['Recruitment Report','Value'],...Object.entries(summary).map(([key,value])=>[key,value]),[],['Branch','Vacancies','Applications','Hires'],...report.branches.map(b=>[b.name,b.vacancies,b.applications,b.hires]),[],['Stage','Applications'],...stages.map(s=>[s.label,s.count]),[],['Month','Applications','Hires'],...monthly.map(m=>[m.month,m.applications,m.hires]),[],['Reminders','Count'],...alerts.map(al=>[al.message,al.count])];
   return new NextResponse('\uFEFF'+rows.map(r=>r.map(safeCsv).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="nexora-recruitment-report.csv"','Cache-Control':'no-store'}});
  }
  return ok(report);
 }catch(e){console.error('Recruitment analytics GET',e);return fail('Unable to load recruitment analytics',500)}
}
