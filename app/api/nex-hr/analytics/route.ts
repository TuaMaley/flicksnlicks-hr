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
 return ok({threads,answersSampled:assistantMessages.length,refusalsSampled:refused,feedback:feedback.map(x=>({rating:x.rating,count:x._count._all})),documentCounts:documentCounts.map(x=>({status:x.status,category:x.category,count:x._count._all})),note:'Answer counts and refusals cover up to the 1,000 most recent assistant messages.'});
}
