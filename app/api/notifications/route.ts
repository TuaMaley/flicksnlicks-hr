import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../lib/auth';
import {db} from '../../../lib/db';

type Notice={id:string;title:string;message:string;href:string;kind:string;readAt:Date|null;createdAt:Date};
export async function GET(){
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
 const notices=await db.$queryRaw<Notice[]>`
 SELECT "id","title","message","href","kind","readAt","createdAt" FROM "NexoraNotification"
 WHERE "userId"=${a.user.id} AND ("companyId" IS NULL OR "companyId"=${a.companyId||''})
 ORDER BY "createdAt" DESC LIMIT 60`;
 const unread=await db.$queryRaw<{count:bigint}[]>`
 SELECT COUNT(*)::bigint AS count FROM "NexoraNotification"
 WHERE "userId"=${a.user.id} AND "readAt" IS NULL AND ("companyId" IS NULL OR "companyId"=${a.companyId||''})`;
 return NextResponse.json({notifications:notices,unread:Number(unread[0]?.count||0)});
 }catch(e){console.error('Notification read failed',e);return NextResponse.json({error:'Notifications unavailable. Check database migration.'},{status:503})}
}
export async function PATCH(req:NextRequest){
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 let body:{id?:string;all?:boolean};try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 if(!body.all&&(!body.id||typeof body.id!=='string'))return NextResponse.json({error:'Notification ID required'},{status:400});
 try{
 if(body.all){await db.$executeRaw`UPDATE "NexoraNotification" SET "readAt"=CURRENT_TIMESTAMP WHERE "userId"=${a.user.id} AND "readAt" IS NULL AND ("companyId" IS NULL OR "companyId"=${a.companyId||''})`}
 else{await db.$executeRaw`UPDATE "NexoraNotification" SET "readAt"=COALESCE("readAt",CURRENT_TIMESTAMP) WHERE "id"=${body.id!} AND "userId"=${a.user.id} AND ("companyId" IS NULL OR "companyId"=${a.companyId||''})`}
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Unable to update notifications'},{status:503})}
}
