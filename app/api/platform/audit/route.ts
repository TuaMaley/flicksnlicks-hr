import {NextRequest, NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

export async function GET(req:NextRequest){
 const session=await currentUser();
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const actor=await db.user.findUnique({where:{id:session.id},select:{active:true,platformAdmin:true}});
 if(!actor?.active||!actor.platformAdmin)return NextResponse.json({error:'Platform administrator access required'},{status:403});
 const params=req.nextUrl.searchParams;
 const companyId=params.get('companyId')?.trim()||'';
 const action=params.get('action')?.trim()||'';
 const cursor=params.get('cursor')?.trim()||'';
 const limit=Math.min(100,Math.max(10,Number(params.get('limit'))||30));
 if(action.length>100||companyId.length>100||cursor.length>100)return NextResponse.json({error:'Invalid filters'},{status:400});
 const where:any={action:{startsWith:'PLATFORM_'}};
 if(companyId)where.companyId=companyId;
 if(action)where.action={startsWith:action.startsWith('PLATFORM_')?action:'PLATFORM_'+action};
 if(cursor){const found=await db.auditLog.findUnique({where:{id:cursor},select:{id:true}});if(!found)return NextResponse.json({error:'Invalid cursor'},{status:400});}
 const logs=await db.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,...(cursor?{skip:1,cursor:{id:cursor}}:{}),select:{id:true,createdAt:true,actorId:true,companyId:true,action:true,entity:true,entityId:true,detail:true}});
 const hasMore=logs.length>limit;const rows=logs.slice(0,limit);
 const actorIds=[...new Set(rows.map(r=>r.actorId).filter((x):x is string=>!!x))];
 const companyIds=[...new Set(rows.map(r=>r.companyId).filter((x):x is string=>!!x))];
 const [users,companies]=await Promise.all([db.user.findMany({where:{id:{in:actorIds}},select:{id:true,name:true,email:true}}),db.company.findMany({where:{id:{in:companyIds}},select:{id:true,name:true,code:true}})]);
 const usersById=new Map(users.map(u=>[u.id,u]));const companiesById=new Map(companies.map(c=>[c.id,c]));
 return NextResponse.json({rows:rows.map(r=>({...r,actor:r.actorId?usersById.get(r.actorId)||null:null,company:r.companyId?companiesById.get(r.companyId)||null:null})),nextCursor:hasMore?rows[rows.length-1]?.id:null},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
