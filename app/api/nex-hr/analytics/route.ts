import {db} from '../../../../lib/db';
import {gate} from '../../../../lib/nexhr';
import {ok} from '../../../../lib/http';
import {REFUSAL} from '../../../../lib/nexhr-chat';
const UNVERIFIED='I found relevant policy material but could not confirm the specific answer.';
export async function GET(){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 const companyId=a.companyId!;
 const [threads,feedback,assistantMessages,documentCounts]=await Promise.all([
  db.nexHrChatThread.count({where:{companyId}}),
  db.nexHrAnswerFeedback.groupBy({by:['rating'],where:{companyId},_count:{_all:true}}),
  db.nexHrChatMessage.findMany({where:{role:'assistant',thread:{companyId}},select:{content:true,threadId:true,createdAt:true,citations:true},orderBy:{createdAt:'desc'},take:1000}),
  db.nexHrDocument.groupBy({by:['status','category'],where:{companyId},_count:{_all:true}})
 ]);
 const now=new Date();
 const inThirtyDays=new Date(now.getTime()+30*86400000);
 const [pendingReviews,expiredApproved,expiringSoon,futureEffective]=await Promise.all([
  db.nexHrDocument.count({where:{companyId,status:'PENDING'}}),
  db.nexHrDocument.count({where:{companyId,status:'APPROVED',expiresAt:{lte:now}}}),
  db.nexHrDocument.count({where:{companyId,status:'APPROVED',expiresAt:{gt:now,lte:inThirtyDays}}}),
  db.nexHrDocument.count({where:{companyId,status:'APPROVED',effectiveAt:{gt:now}}})
 ]);
 const documentQuality=await db.nexHrDocument.findMany({
  where:{companyId,status:'APPROVED'},
  select:{id:true,title:true,version:true,mimeType:true,fileData:true,visibility:true,effectiveAt:true,expiresAt:true},
  orderBy:{updatedAt:'desc'},take:500
 });
 const emptyFiles=documentQuality.filter(d=>!d.fileData||d.fileData.length===0).length;
 const unsupportedFormats=documentQuality.filter(d=>!(
  d.mimeType==='application/pdf'||d.mimeType==='text/plain'||
  d.mimeType.includes('wordprocessingml')
 )).length;
 const missingEffectiveDate=documentQuality.filter(d=>!d.effectiveAt).length;
 const missingExpiryDate=documentQuality.filter(d=>!d.expiresAt).length;
 const documentQualitySummary={
  inspected:documentQuality.length,limitedTo500:documentQuality.length===500,
  emptyFiles,unsupportedFormats,missingEffectiveDate,missingExpiryDate
 };
 const refused=assistantMessages.filter(m=>m.content===REFUSAL).length;
 const unverified=assistantMessages.filter(m=>m.content.startsWith(UNVERIFIED)).length;
 const hasCitations=(m:typeof assistantMessages[number])=>Array.isArray(m.citations)&&m.citations.length>0;
 const uncitedRefusals=assistantMessages.filter(m=>m.content===REFUSAL&&!hasCitations(m)).length;
 const citedUnverified=assistantMessages.filter(m=>m.content.startsWith(UNVERIFIED)&&hasCitations(m)).length;
 const citedAnswers=assistantMessages.filter(m=>m.content!==REFUSAL&&!m.content.startsWith(UNVERIFIED)&&hasCitations(m)).length;
 const uncitedAnswers=assistantMessages.filter(m=>m.content!==REFUSAL&&!m.content.startsWith(UNVERIFIED)&&!hasCitations(m)).length;
 // Find the immediately preceding user question for recent unsupported answers.
 const refusalThreads=[...new Set(assistantMessages.filter(m=>m.content===REFUSAL||m.content.startsWith(UNVERIFIED)).map(m=>m.threadId))].slice(0,50);
 const messages=refusalThreads.length?await db.nexHrChatMessage.findMany({where:{threadId:{in:refusalThreads}},select:{threadId:true,role:true,content:true,createdAt:true},orderBy:{createdAt:'asc'},take:2000}):[];
 const gapQuestions:string[]=[];
 const lastUser=new Map<string,string>();
 for(const m of messages){
  if(m.role==='user')lastUser.set(m.threadId,m.content);
  if(m.role==='assistant'&&(m.content===REFUSAL||m.content.startsWith(UNVERIFIED))){const q=lastUser.get(m.threadId);if(q&&!gapQuestions.includes(q))gapQuestions.push(q)}
 }
 return ok({threads,documentQuality:documentQualitySummary,policyLifecycle:{pendingReviews,expiredApproved,expiringSoon,futureEffective},knowledgeGapQuestions:gapQuestions.slice(-15).reverse(),answersSampled:assistantMessages.length,refusalsSampled:refused,answerQuality:{uncitedRefusals,citedUnverified,unverified,citedAnswers,uncitedAnswers},feedback:feedback.map(x=>({rating:x.rating,count:x._count._all})),documentCounts:documentCounts.map(x=>({status:x.status,category:x.category,count:x._count._all})),note:'Answer counts and refusals cover up to the 1,000 most recent assistant messages. Unanswered questions include refusals and verification fallbacks, sampled from up to 50 conversations. Citation counts reflect stored citations, not independently verified accuracy.'});
}
