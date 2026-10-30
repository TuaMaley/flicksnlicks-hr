import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {securityAdmin} from '../../../../lib/accessSecurity';
export async function GET(req:NextRequest){
 const auth=await securityAdmin();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const q=req.nextUrl.searchParams;
 const page=Math.max(1,Math.min(10000,Number(q.get('page'))||1));
 const search=(q.get('search')||'').trim().slice(0,120);
 const entity=(q.get('entity')||'').trim().slice(0,100);
 const where:any={};
 if(search)where.OR=[{action:{contains:search,mode:'insensitive'}},{entity:{contains:search,mode:'insensitive'}},{entityId:{contains:search,mode:'insensitive'}}];
 if(entity)where.entity=entity;
 const [items,total]=await Promise.all([db.auditLog.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*25,take:25}),db.auditLog.count({where})]);
 const ids=[...new Set(items.map(x=>x.actorId).filter((x):x is string=>!!x))];
 const users=ids.length?await db.user.findMany({where:{id:{in:ids}},select:{id:true,name:true,email:true}}):[];
 const names=new Map(users.map(x=>[x.id,x]));
 return NextResponse.json({items:items.map(x=>({...x,actor:x.actorId?names.get(x.actorId)||null:null})),total,page});
}
