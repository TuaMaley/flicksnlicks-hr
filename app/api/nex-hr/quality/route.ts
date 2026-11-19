import {NextRequest} from 'next/server';
import {Prisma} from '@prisma/client';
import {db} from '../../../../lib/db';
import {gate} from '../../../../lib/nexhr';
import {ok,fail} from '../../../../lib/http';
import {REFUSAL} from '../../../../lib/nexhr-chat';
const ENTITY='NexHrQualityReview', ACTION='NEXHR_QUALITY_REVIEW';
const FALLBACK='I found relevant policy material but could not confirm the specific answer.';
const statuses=['OPEN','REVIEWED','NEEDS_POLICY_UPDATE'];
export async function GET(){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 const companyId=a.companyId!;
 const [messages,feedback]=await Promise.all([
  db.nexHrChatMessage.findMany({where:{role:'assistant',thread:{companyId}},select:{id:true,threadId:true,content:true,createdAt:true,citations:true},orderBy:{createdAt:'desc'},take:500}),
  db.nexHrAnswerFeedback.findMany({where:{companyId,rating:'NOT_HELPFUL'},select:{messageId:true,comment:true,createdAt:true},orderBy:{createdAt:'desc'},take:200})
 ]);
 const negative=new Map(feedback.map(f=>[f.messageId,f]));
 const candidates=messages.filter(m=>negative.has(m.id)||m.content===REFUSAL||m.content.startsWith(FALLBACK)).slice(0,100);
 const ids=candidates.map(m=>m.id);
 const [reviews,threadMessages]=await Promise.all([
  ids.length?db.auditLog.findMany({where:{companyId,entity:ENTITY,action:ACTION,entityId:{in:ids}},select:{entityId:true,detail:true,createdAt:true},orderBy:{createdAt:'desc'},take:1000}):Promise.resolve([]),
  candidates.length?db.nexHrChatMessage.findMany({where:{threadId:{in:[...new Set(candidates.map(m=>m.threadId))]}},select:{id:true,threadId:true,role:true,content:true,createdAt:true},orderBy:{createdAt:'asc'},take:3000}):Promise.resolve([])
 ]);
 const latest=new Map<string,{status:string;note:string}>();
 for(const r of reviews){if(!r.entityId||latest.has(r.entityId))continue;
  const detail=r.detail&&typeof r.detail==='object'&&!Array.isArray(r.detail)?r.detail as Record<string,unknown>:{};
  latest.set(r.entityId,{status:typeof detail.status==='string'&&statuses.includes(detail.status)?detail.status:'OPEN',note:typeof detail.note==='string'?detail.note:''});
 }
 const preceding=new Map<string,string>(),lastUser=new Map<string,string>();
 for(const m of threadMessages){if(m.role==='user')lastUser.set(m.threadId,m.content);if(m.role==='assistant')preceding.set(m.id,lastUser.get(m.threadId)||'');}
 const items=candidates.map(m=>({id:m.id,createdAt:m.createdAt,question:(preceding.get(m.id)||'').slice(0,800),answer:m.content.slice(0,1200),reason:negative.has(m.id)?'NOT_HELPFUL':m.content===REFUSAL?'REFUSAL':'UNVERIFIED',feedback:negative.get(m.id)?.comment?.slice(0,500)||'',citationCount:Array.isArray(m.citations)?m.citations.length:0,status:latest.get(m.id)?.status||'OPEN',reviewNote:latest.get(m.id)?.note||''}));
 return ok({items,summary:{sampledAssistantMessages:messages.length,candidateCount:items.length,open:items.filter(i=>i.status==='OPEN').length,reviewed:items.filter(i=>i.status==='REVIEWED').length,needsPolicyUpdate:items.filter(i=>i.status==='NEEDS_POLICY_UPDATE').length},note:'Bounded sample: latest 500 assistant messages, 200 negative feedback records, and 100 review cases. Questions may contain employee information; access is restricted to Nex HR managers.'});
}
export async function POST(req:NextRequest){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 let body:unknown;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('Invalid request',400);
 const input=body as Record<string,unknown>,messageId=typeof input.messageId==='string'?input.messageId.trim():'',status=input.status,note=typeof input.note==='string'?input.note.trim():'';
 if(!messageId||messageId.length>128||typeof status!=='string'||!statuses.includes(status)||note.length>1000)return fail('Invalid review fields',400);
 if(status==='NEEDS_POLICY_UPDATE'&&!note)return fail('A reason is required for policy updates',400);
 const companyId=a.companyId!;
 const message=await db.nexHrChatMessage.findFirst({where:{id:messageId,role:'assistant',thread:{companyId}},select:{id:true}});
 if(!message)return fail('Message not found in selected company',404);
 await db.auditLog.create({data:{companyId,actorId:a.user!.id,entity:ENTITY,entityId:messageId,action:ACTION,detail:{status,note} as Prisma.InputJsonValue}});
 return ok({saved:true,status});
}
