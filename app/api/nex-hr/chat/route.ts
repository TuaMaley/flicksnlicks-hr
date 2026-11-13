import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {gate} from '../../../../lib/nexhr';
import {ok,fail} from '../../../../lib/http';
import {retrieve,answerWithSources} from '../../../../lib/nexhr-chat';
import {allowedToRead} from '../../../../lib/nexhr';
import {Prisma} from '@prisma/client';
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
 const question=String(input?.question||'').trim();const threadId=typeof input?.threadId==='string'?input.threadId:'';
 if(question.length<3||question.length>1200)return fail('Question must be between 3 and 1200 characters',400);
 let thread;
 if(threadId){thread=await db.nexHrChatThread.findFirst({where:{id:threadId,companyId:a.companyId!,userId:a.user!.id}});if(!thread)return fail('Conversation not found',404)}
 try{
  const isCountQuestion=/\b(how many|number of|count|total)\b/i.test(question)&&/\b(policies|policy documents|documents in (?:the |our )?knowledge base)\b/i.test(question);
  let response:string;
  let cited:{documentId:string;title:string;version:number;page:number|null;excerpt:string}[]=[];
  if(isCountQuestion){
   const now=new Date();
   const documents=await db.nexHrDocument.findMany({where:{companyId:a.companyId!,status:'APPROVED',OR:[{effectiveAt:null},{effectiveAt:{lte:now}}],AND:[{OR:[{expiresAt:null},{expiresAt:{gt:now}}]}]},select:{familyId:true,category:true,visibility:true}});
   const visible=documents.filter(d=>allowedToRead(a,d));
   const families=new Set(visible.filter(d=>/policy/i.test(d.category)).map(d=>d.familyId));
   response=`You have ${families.size} approved, currently effective policy document${families.size===1?'':'s'} available to your account. Different versions of the same policy are counted once.`;
  }else{
   const evidence=await retrieve(a,question);
   const result=await answerWithSources(question,evidence);
   response=result.text;
   cited=result.usedEvidence.map(({documentId,title,version,page,excerpt})=>({documentId,title,version,page,excerpt}));
  }
  const saved=await db.$transaction(async tx=>{
   const t=thread||await tx.nexHrChatThread.create({data:{companyId:a.companyId!,userId:a.user!.id,title:question.slice(0,180)}});
   await tx.nexHrChatMessage.create({data:{threadId:t.id,role:'user',content:question}});
   const message=await tx.nexHrChatMessage.create({data:{threadId:t.id,role:'assistant',content:response,citations:cited as unknown as Prisma.InputJsonValue}});
   await tx.nexHrChatThread.update({where:{id:t.id},data:{updatedAt:new Date()}});
   return {threadId:t.id,message};
  });
  return ok({...saved,citations:cited});
 }catch(e){console.error('Nex HR chat error',e);return fail('Unable to process your question',500)}
}
export async function DELETE(req:NextRequest){
 const {a,error}=await gate();if(error)return error;
 const threadId=req.nextUrl.searchParams.get('threadId');if(!threadId)return fail('Conversation ID required',400);
 const deleted=await db.nexHrChatThread.deleteMany({where:{id:threadId,companyId:a.companyId!,userId:a.user!.id}});
 return deleted.count?ok({deleted:true}):fail('Conversation not found',404);
}
