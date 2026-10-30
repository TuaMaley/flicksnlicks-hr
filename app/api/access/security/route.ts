import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {securityAdmin} from '../../../../lib/accessSecurity';
import {selectedCompany} from '../../../../lib/companyContext';

async function companyScope(){
 const state=await selectedCompany();
 return state?.selected?.companyId || null;
}
const denied=()=>NextResponse.json({error:'Active company membership required'},{status:403});


export async function GET(req:NextRequest){
 try{
  const auth=await securityAdmin();
  if('error' in auth)return NextResponse.json({error:auth.error},{status:auth.status});
  const companyId=await companyScope();if(!companyId)return denied();
  const params=req.nextUrl.searchParams;
  const page=Math.max(1,Math.min(100000,Number(params.get('page'))||1));
  const userId=(params.get('userId')||'').trim();
  const event=(params.get('event')||'').trim();
  const start=params.get('start')||'';
  const end=params.get('end')||'';
  const types=['LOGIN','LOGIN_SUCCESS','LOGIN_FAILURE','LOGOUT'];
  if(event&&!types.includes(event))return NextResponse.json({error:'Invalid event filter'},{status:400});
  const dateFilter:Record<string,Date>={};
  if(start){const d=new Date(start+'T00:00:00.000Z');if(Number.isNaN(d.getTime()))return NextResponse.json({error:'Invalid start date'},{status:400});dateFilter.gte=d}
  if(end){const d=new Date(end+'T23:59:59.999Z');if(Number.isNaN(d.getTime()))return NextResponse.json({error:'Invalid end date'},{status:400});dateFilter.lte=d}
  const where:any={companyId,OR:[{entity:'Authentication',action:{in:types}},{entity:'User',action:'LOGIN'}]};
  if(userId)where.actorId=userId;
  if(event)where.action=event;
  if(Object.keys(dateFilter).length)where.createdAt=dateFilter;
  const [items,total,users]=await Promise.all([
   db.auditLog.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*25,take:25}),
   db.auditLog.count({where}),
   db.user.findMany({where:{platformAdmin:false,companyMemberships:{some:{companyId,active:true}}},select:{id:true,name:true,email:true,active:true},orderBy:{name:'asc'}})
  ]);
  const byId=new Map(users.map(u=>[u.id,u]));
  return NextResponse.json({items:items.map(row=>({...row,actor:row.actorId?byId.get(row.actorId)||null:null})),users,total,page});
 }catch(error){console.error('Login & Security report failed',error);return NextResponse.json({error:'Unable to load login and security events'},{status:500})}
}
