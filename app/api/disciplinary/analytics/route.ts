import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';

export async function GET(req:NextRequest){
 try {
  const a=await access();if(!a.user)return fail('Unauthorized',401);
  if(!a.can('disciplinary.view'))return fail('Forbidden',403);
  const params=req.nextUrl.searchParams;
  const from=params.get('from')||'';const to=params.get('to')||'';
  if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to)))return fail('Invalid date filter',400);
  const fromDate=from?new Date(from+'T00:00:00.000Z'):undefined;
  const toDate=to?new Date(to+'T23:59:59.999Z'):undefined;
  if((fromDate&&isNaN(fromDate.getTime()))||(toDate&&isNaN(toDate.getTime()))||(fromDate&&toDate&&fromDate>toDate))return fail('Invalid date range',400);
  const where:any={employee:employeeWhere(a)};
  if(fromDate||toDate)where.incidentDate={...(fromDate?{gte:fromDate}:{}),...(toDate?{lte:toDate}:{})};
  const cases=await db.disciplinaryCase.findMany({where,select:{id:true,employeeId:true,summary:true,category:true,status:true,severity:true,incidentDate:true,createdAt:true,decidedAt:true,policyOffenceCode:true,sanctionApplied:true,employee:{select:{employeeNo:true,firstName:true,lastName:true,department:true,branch:{select:{name:true}}}},hearings:{select:{id:true,status:true,scheduledAt:true}},appeals:{select:{id:true,status:true}}},orderBy:{incidentDate:'desc'},take:5000});
  const today=new Date();
  const count=(xs:string[])=>xs.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{} as Record<string,number>);
  const totals={cases:cases.length,open:cases.filter(c=>c.status==='OPEN').length,underReview:cases.filter(c=>c.status==='UNDER_REVIEW').length,resolved:cases.filter(c=>c.status==='RESOLVED').length,closed:cases.filter(c=>c.status==='CLOSED').length,pendingHearings:cases.flatMap(c=>c.hearings).filter(h=>h.status==='SCHEDULED').length,overdueHearings:cases.flatMap(c=>c.hearings).filter(h=>h.status==='SCHEDULED'&&h.scheduledAt<today).length,pendingAppeals:cases.flatMap(c=>c.appeals).filter(p=>p.status==='PENDING').length};
  const decided=cases.filter(c=>c.decidedAt);
  const avgDays=decided.length?Math.round(decided.reduce((n,c)=>n+(c.decidedAt!.getTime()-c.createdAt.getTime())/86400000,0)/decided.length*10)/10:null;
  const confirmed=cases.filter(c=>c.status==='CLOSED'&&!!c.sanctionApplied);
  const repeatMap=new Map<string,Set<string>>();for(const c of confirmed){if(!c.policyOffenceCode)continue;const key=c.employeeId+'|'+c.policyOffenceCode;repeatMap.set(key,(repeatMap.get(key)||new Set<string>()).add(c.id));}
  const repeatOffenceGroups=[...repeatMap.values()].filter(ids=>ids.size>1).length;
  const sorted=(r:Record<string,number>)=>Object.entries(r).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}));
  return ok({totals,avgResolutionDays:avgDays,repeatOffenceGroups,byBranch:sorted(count(cases.map(c=>c.employee.branch?.name||'Unassigned'))),byDepartment:sorted(count(cases.map(c=>c.employee.department||'Unassigned'))),byCategory:sorted(count(cases.map(c=>c.category||'OTHER'))),byStatus:sorted(count(cases.map(c=>c.status))),byOffence:sorted(count(cases.map(c=>c.policyOffenceCode||'Not classified'))),bySanction:sorted(count(confirmed.map(c=>c.sanctionApplied||'Not recorded'))),rows:cases.map(c=>({id:c.id,employee:c.employee.firstName+' '+c.employee.lastName,employeeNo:c.employee.employeeNo,branch:c.employee.branch?.name||'',department:c.employee.department,summary:c.summary,category:c.category,offence:c.policyOffenceCode,status:c.status,sanction:c.status==='CLOSED'?c.sanctionApplied:null,incidentDate:c.incidentDate.toISOString().slice(0,10)})),truncated:cases.length===5000});
 }catch(e){console.error('Disciplinary analytics GET',e);return fail('Unable to load disciplinary analytics',500)}
}
