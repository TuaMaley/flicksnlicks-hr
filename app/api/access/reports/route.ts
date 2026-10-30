import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {securityAdmin} from '../../../../lib/accessSecurity';
import {selectedCompany} from '../../../../lib/companyContext';

async function companyScope(){
 const state=await selectedCompany();
 return state?.selected?.companyId || null;
}
const denied=()=>NextResponse.json({error:'Active company membership required'},{status:403});


const eventActions=['LOGIN','LOGIN_SUCCESS','LOGIN_FAILURE','LOGOUT'];
function dateValue(s:string|null,end=false){
 if(!s)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return undefined;
 const d=new Date(s+(end?'T23:59:59.999Z':'T00:00:00.000Z'));
 return Number.isNaN(d.getTime())?undefined:d;
}
export async function GET(req:NextRequest){
 try{
  const auth=await securityAdmin();
  if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const companyId=await companyScope();if(!companyId)return denied();
  const p=req.nextUrl.searchParams;
  const start=dateValue(p.get('start')),end=dateValue(p.get('end'),true);
  if(start===undefined||end===undefined||(start&&end&&start>end))
   return NextResponse.json({error:'Invalid date range'},{status:400});
  const userId=(p.get('userId')||'').trim();
  const branchId=(p.get('branchId')||'').trim();
  const department=(p.get('department')||'').trim();
  const [users,roles,branches]=await Promise.all([
   db.user.findMany({where:{platformAdmin:false,companyMemberships:{some:{companyId,active:true}}},select:{id:true,name:true,email:true,active:true,employee:{select:{branchId:true,department:true}},roles:{select:{role:{select:{id:true,name:true,active:true,permissions:{select:{permission:{select:{key:true}}}}}}}}},orderBy:{name:'asc'}}),
   db.role.findMany({where:{users:{some:{user:{platformAdmin:false,companyMemberships:{some:{companyId,active:true}}}}}},select:{id:true,name:true,active:true,_count:{select:{users:true}}},orderBy:{name:'asc'}}),
   db.branch.findMany({where:{companyId},select:{id:true,name:true},orderBy:{name:'asc'}})
  ]);
  const scoped=users.filter(u=>(!userId||u.id===userId)&&(!branchId||u.employee?.branchId===branchId)&&(!department||u.employee?.department===department));
  const ids=scoped.map(u=>u.id);
  const dateWhere:any={};
  if(start)dateWhere.gte=start;
  if(end)dateWhere.lte=end;
  const auditWhere:any={companyId};
  if(start||end)auditWhere.createdAt=dateWhere;
  auditWhere.actorId={in:ids};
  const loginWhere:any={...auditWhere,OR:[{entity:'Authentication',action:{in:eventActions}},{entity:'User',action:'LOGIN'}]};
  const reviewWhere:any={companyId};
  if(start||end)reviewWhere.createdAt=dateWhere;
  reviewWhere.userId={in:ids};
  const [auditTotal,loginGroups,auditGroups,reviewGroups,overdue,activity]=await Promise.all([
   db.auditLog.count({where:auditWhere}),
   db.auditLog.groupBy({by:['action'],where:loginWhere,_count:{_all:true}}),
   db.auditLog.groupBy({by:['actorId'],where:auditWhere,_count:{_all:true},orderBy:{_count:{id:'desc'}},take:20}),
   db.accessReview.groupBy({by:['status'],where:reviewWhere,_count:{_all:true}}),
   db.accessReview.count({where:{...reviewWhere,status:'OPEN',dueDate:{lt:new Date()}}}),
   db.auditLog.findMany({where:auditWhere,select:{createdAt:true},orderBy:{createdAt:'desc'},take:3000})
  ]);
  const eventCounts=Object.fromEntries(loginGroups.map(x=>[x.action,x._count._all]));
  const dayCounts=new Map<string,number>();
  for(const a of activity){const day=a.createdAt.toISOString().slice(0,10);dayCounts.set(day,(dayCounts.get(day)||0)+1)}
  const topUsers=auditGroups.filter(x=>x.actorId).slice(0,10).map(x=>({id:x.actorId,name:users.find(u=>u.id===x.actorId)?.name||'Former user',count:x._count._all}));
  const reviewCounts=Object.fromEntries(reviewGroups.map(x=>[x.status,x._count._all]));
  const roleDistribution=roles.map(r=>({name:r.name,count:scoped.filter(u=>u.roles.some(x=>x.role.id===r.id)).length}));
  const privileged=scoped.filter(u=>u.roles.some(r=>r.role.active&&r.role.permissions.some(p=>p.permission.key.startsWith('access.')||p.permission.key==='payroll.approve'))).length;
  return NextResponse.json({
   filters:{users:users.map(u=>({id:u.id,name:u.name,email:u.email})),branches,departments:[...new Set(users.map(u=>u.employee?.department).filter((x):x is string=>!!x))].sort()},
   metrics:{totalUsers:scoped.length,activeUsers:scoped.filter(u=>u.active).length,inactiveUsers:scoped.filter(u=>!u.active).length,totalRoles:roles.length,auditTotal,successfulLogins:(eventCounts.LOGIN||0)+(eventCounts.LOGIN_SUCCESS||0),failedLogins:eventCounts.LOGIN_FAILURE||0,logouts:eventCounts.LOGOUT||0,privilegedUsers:privileged,openReviews:reviewCounts.OPEN||0,approvedReviews:reviewCounts.APPROVED||0,flaggedReviews:reviewCounts.FLAGGED||0,overdueReviews:overdue},
   roleDistribution,topUsers,activityTrend:[...dayCounts].sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count})),
   note:'Activity trend is limited to the latest 3,000 matching audit events. User, branch and department filters apply to activity actors and review subjects; account and role metrics are current-state snapshots.'
  });
 }catch(error){console.error('Access reporting failed',error);return NextResponse.json({error:'Unable to load access analytics'},{status:500})}
}
