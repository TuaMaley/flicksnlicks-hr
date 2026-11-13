import {db} from '../../../../lib/db';
import {gate} from '../../../../lib/nexhr';
import {ok} from '../../../../lib/http';
import {REFUSAL} from '../../../../lib/nexhr-chat';
export async function GET(){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 const companyId=a.companyId!;
 const [threads,feedback,assistantMessages,documentCounts]=await Promise.all([
  db.nexHrChatThread.count({where:{companyId}}),
  db.nexHrAnswerFeedback.groupBy({by:['rating'],where:{companyId},_count:{_all:true}}),
  db.nexHrChatMessage.findMany({where:{role:'assistant',thread:{companyId}},select:{content:true,threadId:true,createdAt:true},orderBy:{createdAt:'desc'},take:1000}),
  db.nexHrDocument.groupBy({by:['status','category'],where:{companyId},_count:{_all:true}})
 ]);
 const refused=assistantMessages.filter(m=>m.content===REFUSAL).length;
 // Find the immediately preceding user question for recent unsupported answers.
 const refusalThreads=[...new Set(assistantMessages.filter(m=>m.content===REFUSAL).map(m=>m.threadId))].slice(0,50);
 const messages=refusalThreads.length?await db.nexHrChatMessage.findMany({where:{threadId:{in:refusalThreads}},select:{threadId:true,role:true,content:true,createdAt:true},orderBy:{createdAt:'asc'},take:2000}):[];
 const gapQuestions:string[]=[];
 const lastUser=new Map<string,string>();
 for(const m of messages){
  if(m.role==='user')lastUser.set(m.threadId,m.content);
  if(m.role==='assistant'&&m.content===REFUSAL){const q=lastUser.get(m.threadId);if(q&&!gapQuestions.includes(q))gapQuestions.push(q)}
 }
 return ok({threads,knowledgeGapQuestions:gapQuestions.slice(-15).reverse(),answersSampled:assistantMessages.length,refusalsSampled:refused,feedback:feedback.map(x=>({rating:x.rating,count:x._count._all})),documentCounts:documentCounts.map(x=>({status:x.status,category:x.category,count:x._count._all})),note:'Answer counts and refusals cover up to the 1,000 most recent assistant messages. Knowledge gaps are sampled from up to 50 conversations and may be incomplete.'});
}
