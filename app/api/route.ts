import {NextRequest} from 'next/server';
import {db} from '../../../lib/db';
import {access} from '../../../lib/auth';
import {fail,ok} from '../../../lib/http';

import {statuses,trainingData} from '../../../lib/training-data';

export async function GET(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.view'))return fail('Forbidden',403);
 const q=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,100);
 const status=req.nextUrl.searchParams.get('status')||'';
 if(status&&!statuses.includes(status))return fail('Invalid status',400);
 const where:any={...(status?{status}:{}),...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{code:{contains:q,mode:'insensitive'}},{category:{contains:q,mode:'insensitive'}}]}:{})};
 const trainings=await db.training.findMany({where,orderBy:[{startDate:'asc'},{createdAt:'desc'}],take:500});
 return ok({trainings});
}
export async function POST(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.create'))return fail('Forbidden',403);
 try{const data=trainingData(await req.json());const training=await db.$transaction(async tx=>{
 const created=await tx.training.create({data:{...data,createdById:a.user!.id}});
 await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_CREATED',entity:'Training',entityId:created.id,detail:{title:created.title,code:created.code}}});return created;
 });return ok({training},201);
 }catch(e:any){if(e?.code==='P2002')return fail('Training code already exists',409);if(e instanceof SyntaxError)return fail('Invalid JSON',400);if(e?.message?.startsWith('Invalid')||e?.message?.includes('required')||e?.message?.includes('must')||e?.message?.includes('requires'))return fail(e.message,400);console.error('Training creation failed',e);return fail('Unable to create training',500)}
}
