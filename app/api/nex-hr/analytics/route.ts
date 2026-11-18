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
 const [recentAudit,versionRows,negativeFeedback]=await Promise.all([
  db.nexHrAuditEvent.findMany({where:{companyId},orderBy:{createdAt:'desc'},take:30,select:{id:true,documentId:true,action:true,createdAt:true}}),
  db.nexHrDocument.findMany({where:{companyId},select:{id:true,familyId:true,title:true,version:true,status:true,effectiveAt:true,expiresAt:true,reviewedAt:true},orderBy:[{familyId:'asc'},{version:'desc'}],take:500}),
  db.nexHrAnswerFeedback.count({where:{companyId,rating:'NOT_HELPFUL'}})
 ]);
 const versions=new Map<string,{familyId:string;title:string;versions:number;latestVersion:number;approvedVersions:number;latestStatus:string}>();
 for(const d of versionRows){const v=versions.get(d.familyId);
  if(!v)versions.set(d.familyId,{familyId:d.familyId,title:d.title,versions:1,latestVersion:d.version,approvedVersions:d.status==='APPROVED'?1:0,latestStatus:d.status});
  else {v.versions++;if(d.status==='APPROVED')v.approvedVersions++;if(d.version>v.latestVersion){v.latestVersion=d.version;v.latestStatus=d.status;v.title=d.title}}
 }
 const recent30=new Date(now.getTime()-30*86400000);
 const recentAssistant=assistantMessages.filter(m=>m.createdAt>=recent30);
 const recentRefusals=recentAssistant.filter(m=>m.content===REFUSAL).length;
 const recentUnverified=recentAssistant.filter(m=>m.content.startsWith(UNVERIFIED)).length;
 const governanceMonitoring={
  windowDays:30, recentAnswersSampled:recentAssistant.length,recentRefusals,recentUnverified,
  recentRefusalRate:recentAssistant.length?Math.round(1000*recentRefusals/recentAssistant.length)/10:null,
  negativeFeedbackTotal:negativeFeedback,
  auditEvents:recentAudit,versionFamilies:[...versions.values()].filter(v=>v.versions>1).slice(0,30),
  versionsSampled:versionRows.length,versionSampleLimit:500,
  warnings:[...(versionRows.length===500?['Version inventory is limited to 500 records.']:[]),
   ...(assistantMessages.length===1000?['Answer metrics are sampled from the 1,000 newest assistant messages.']:[]),
   'Draft markings inside uploaded documents are not detected automatically. HR must review the signed source and replace outdated versions.']
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
 return ok({governanceMonitoring,threads,policyLifecycle:{pendingReviews,expiredApproved,expiringSoon,futureEffective},knowledgeGapQuestions:gapQuestions.slice(-15).reverse(),answersSampled:assistantMessages.length,refusalsSampled:refused,answerQuality:{uncitedRefusals,citedUnverified,unverified,citedAnswers,uncitedAnswers},feedback:feedback.map(x=>({rating:x.rating,count:x._count._all})),documentCounts:documentCounts.map(x=>({status:x.status,category:x.category,count:x._count._all})),note:'Answer counts and refusals cover up to the 1,000 most recent assistant messages. Unanswered questions include refusals and verification fallbacks, sampled from up to 50 conversations. Citation counts reflect stored citations, not independently verified accuracy.'});
}
