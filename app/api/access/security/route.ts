import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {securityAdmin} from '../../../../lib/accessSecurity';
export async function GET(req:NextRequest){
 const auth=await securityAdmin();if('error'in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const page=Math.max(1,Number(req.nextUrl.searchParams.get('page'))||1);
 const where={entity:'Authentication'};
 const [items,total]=await Promise.all([db.auditLog.findMany({where,orderBy:{createdAt:'desc'},take:25,skip:(page-1)*25}),db.auditLog.count({where})]);
 const ids=[...new Set(items.map(x=>x.actorId).filter((x):x is string=>!!x))];
 const users=ids.length?await db.user.findMany({where:{id:{in:ids}},select:{id:true,name:true,email:true,active:true}}):[];
 const byId=new Map(users.map(x=>[x.id,x]));
 return NextResponse.json({items:items.map(x=>({...x,actor:x.actorId?byId.get(x.actorId)||null:null})),total,page});
}
