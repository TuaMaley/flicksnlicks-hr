import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {gate} from '../../../../lib/nexhr';
import {ok,fail} from '../../../../lib/http';
import {retrieve,answerWithSources} from '../../../../lib/nexhr-chat';
import {allowedToRead} from '../../../../lib/nexhr';
import {Prisma} from '@prisma/client';
import {detectHrIntent,employeeHrAnswer} from '../../../../lib/nexhr-actions-intent';
import {detectPersonalProfileIntent,answerPersonalProfileQuestion} from '../../../../lib/nexhr-personalization';
import {resolveNexHrFollowUp} from '../../../../lib/nexhr-conversation-context';

export const runtime='nodejs';
export async function GET(req:NextRequest){
 const {a,error}=await gate();if(error)return error;
 const threadId=req.nextUrl.searchParams.get('threadId');
 if(threadId){
  const thread=await db.nexHrChatThread.findFirst({where:{id:threadId,companyId:a.companyId!,userId:a.user!.id},include:{messages:{orderBy:{createdAt:'asc'},take:100}}});
  if(!thread)return fail('Conversation not found',404);
  return ok({thread});
 }
 const threads=await db.nexHrChatThread.findMany({where:{companyId:a.companyId!,userId:a.user!.id},orderBy:{updatedAt:'desc'},take:40,select:{id:true,title:true,updatedAt:true}});
 return ok({threads});
}
export async function POST(req:NextRequest){
 const {a,error}=await gate();if(error)return error;
 let input:any;try{input=await req.json()}catch{return fail('Invalid JSON',400)}
 const startedAt=Date.now();
 const question=String(input?.question||'').trim();const threadId=typeof input?.threadId==='string'?input.threadId:'';
 if(question.length<3||question.length>1200)return fail('Question must be between 3 and 1200 characters',400);
 let thread;
 if(threadId){thread=await db.nexHrChatThread.findFirst({where:{id:threadId,companyId:a.companyId!,userId:a.user!.id}});if(!thread)return fail('Conversation not found',404)}
 try{
  const previous=thread ? await db.nexHrChatMessage.findMany({
   where:{threadId:thread.id},orderBy:{createdAt:'desc'},take:12,
   select:{role:true,content:true}
  }) : [];
  const resolvedQuestion=resolveNexHrFollowUp(question,previous.reverse());
  // Resolve follow-ups before routing to authenticated HRMS actions. Never send personal records to the policy model.
  const intent=detectHrIntent(resolvedQuestion);
  const personalIntent=intent?null:detectPersonalProfileIntent(resolvedQuestion);
  // Inventory requests are answered from authorized metadata, never inferred from extracted PDF text.
  const inventoryCount=/\b(how many|number of|count|total)\b/i.test(resolvedQuestion);
  const inventoryList=/\b(list|show|which|what|name)\b/i.test(resolvedQuestion);
  const policyScope=/\b(policies|policy|policy documents)\b/i.test(resolvedQuestion);
  const documentScope=/\b(documents|knowledge base|knowledge documents)\b/i.test(resolvedQuestion);
  const isInventoryQuestion=(inventoryCount||inventoryList)&&(policyScope||documentScope)
   && !/\b(days|hours|entitlement|allowance|benefit amount|sanction|penalty|warning|occurrence)\b/i.test(resolvedQuestion);
  let response:string;
  let responseMode:string='inventory';
  let cited:{documentId:string;title:string;version:number;page:number|null;excerpt:string}[]=[];
  if(intent){
   response=await employeeHrAnswer(a,resolvedQuestion,intent);
   responseMode='hr_action';
  }else if(personalIntent){
   response=await answerPersonalProfileQuestion(a,personalIntent);
   responseMode='personal_profile';
  }else if(isInventoryQuestion){
   const now=new Date();
   const documents=await db.nexHrDocument.findMany({
    where:{companyId:a.companyId!,status:'APPROVED',
     OR:[{effectiveAt:null},{effectiveAt:{lte:now}}],
     AND:[{OR:[{expiresAt:null},{expiresAt:{gt:now}}]}]},
    select:{id:true,familyId:true,title:true,version:true,category:true,visibility:true,status:true},
    orderBy:[{version:'desc'},{updatedAt:'desc'}]
   });
   const visible=documents.filter(d=>allowedToRead(a,d));
   // Policy titles are authoritative for classification even when the upload
   // category is Leave, Conduct, Other, etc. Never classify solely by category.
   const isPolicy=(d:typeof visible[number])=>/\bpolic(?:y|ies)\b/i.test(d.title)||/\bpolic(?:y|ies)\b/i.test(d.category);
   const scoped=policyScope?visible.filter(isPolicy):visible;
   const byFamily=new Map<string,typeof scoped[number]>();
   for(const d of scoped){if(!byFamily.has(d.familyId))byFamily.set(d.familyId,d)}
   const current=[...byFamily.values()].sort((x,y)=>x.title.localeCompare(y.title));
   const noun=policyScope?'policy document':'knowledge document';
   const lead=`Your company has ${current.length} approved, currently effective ${noun}${current.length===1?'':'s'} available to your account. Different versions of the same document are counted once.`;
   response=(inventoryList||current.length<=10)&&current.length
    ?lead+'\n'+current.map((d,i)=>`${i+1}. ${d.title} (v${d.version})`).join('\n')
    :lead;
   // Inventory metadata is not a quoted document passage, so no fabricated citations.
    }else{
   const evidence=await retrieve(a,resolvedQuestion);
   const result=await answerWithSources(resolvedQuestion,evidence);
   response=result.text;
   responseMode=result.mode;
   cited=result.usedEvidence.map(({documentId,title,version,page,excerpt})=>({documentId,title,version,page,excerpt}));
  }
  const saved=await db.$transaction(async tx=>{
   const t=thread||await tx.nexHrChatThread.create({data:{companyId:a.companyId!,userId:a.user!.id,title:question.slice(0,180)}});
   await tx.nexHrChatMessage.create({data:{threadId:t.id,role:'user',content:question}});
   const message=await tx.nexHrChatMessage.create({data:{threadId:t.id,role:'assistant',content:response,citations:cited as unknown as Prisma.InputJsonValue}});
   await tx.nexHrChatThread.update({where:{id:t.id},data:{updatedAt:new Date()}});
   return {threadId:t.id,message};
  });
  console.info('Nex HR request metrics',JSON.stringify({companyId:a.companyId,mode:responseMode,latencyMs:Date.now()-startedAt,citations:cited.length}));
  return ok({...saved,citations:cited});
 }catch(e){console.error('Nex HR chat error',e);return fail('Unable to process your question',500)}
}
export async function DELETE(req:NextRequest){
 const {a,error}=await gate();if(error)return error;
 const threadId=req.nextUrl.searchParams.get('threadId');if(!threadId)return fail('Conversation ID required',400);
 const deleted=await db.nexHrChatThread.deleteMany({where:{id:threadId,companyId:a.companyId!,userId:a.user!.id}});
 return deleted.count?ok({deleted:true}):fail('Conversation not found',404);
}
