import {NextRequest} from 'next/server';
import {db} from '../../../lib/db';
import {access} from '../../../lib/auth';
import {fail,ok} from '../../../lib/http';

const statuses=['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'];
const allowedTypes=['MANDATORY','OPTIONAL'];
const methods=['IN_PERSON','VIRTUAL','HYBRID'];
function parseDate(value:unknown){
 if(value===null||value==='')return null;
 if(typeof value!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(value))throw Error('Invalid date');
 const d=new Date(value+'T00:00:00.000Z');
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Invalid date');
 return d;
}
export function trainingData(d:any){
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid request');
 const required=(key:string)=>{if(typeof d[key]!=='string'||!d[key].trim())throw Error(key+' is required');return d[key].trim()};
 const optional=(key:string)=>{if(d[key]===undefined||d[key]===null||d[key]==='')return null;if(typeof d[key]!=='string')throw Error('Invalid '+key);return d[key].trim().slice(0,1000)||null};
 const status=d.status??'PLANNED';if(!statuses.includes(status))throw Error('Invalid status');
 const trainingType=d.trainingType??'OPTIONAL';if(!allowedTypes.includes(trainingType))throw Error('Invalid training type');
 const deliveryMethod=optional('deliveryMethod');if(deliveryMethod&&!methods.includes(deliveryMethod))throw Error('Invalid delivery method');
 const startDate=parseDate(d.startDate),endDate=parseDate(d.endDate);
 if(startDate&&endDate&&endDate<startDate)throw Error('End date must be on or after start date');
 const number=(key:string,min:number,max:number,integer=false)=>{const v=d[key];if(v===undefined||v===null||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error('Invalid '+key);return n};
 const assessmentRequired=d.assessmentRequired===true;
 const passingScore=number('passingScore',0,100);
 if(passingScore!==null&&!assessmentRequired)throw Error('Passing score requires assessment');
 return {title:required('title').slice(0,200),description:optional('description'),status,code:optional('code'),category:optional('category'),trainingType,deliveryMethod,trainer:optional('trainer'),startDate,endDate,durationHours:number('durationHours',0,10000),location:optional('location'),targetAudience:optional('targetAudience'),maxParticipants:number('maxParticipants',1,100000,true),estimatedCost:number('estimatedCost',0,100000000),assessmentRequired,passingScore};
}
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
