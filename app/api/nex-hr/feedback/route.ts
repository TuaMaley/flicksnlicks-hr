import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {gate} from '../../../../lib/nexhr';
import {ok,fail} from '../../../../lib/http';
export async function POST(req:NextRequest){
 const {a,error}=await gate();if(error)return error;
 let body:any;try{body=await req.json()}catch{return fail('Invalid JSON',400)}
 const messageId=String(body.messageId||'');const rating=String(body.rating||'');const comment=String(body.comment||'').slice(0,1000);
 if(!['HELPFUL','NOT_HELPFUL'].includes(rating)||!messageId)return fail('Invalid feedback',400);
 const message=await db.nexHrChatMessage.findFirst({where:{id:messageId,role:'assistant',thread:{companyId:a.companyId!,userId:a.user!.id}},select:{id:true}});
 if(!message)return fail('Message not found',404);
 await db.nexHrAnswerFeedback.upsert({where:{messageId},create:{companyId:a.companyId!,userId:a.user!.id,messageId,rating,comment},update:{rating,comment}});
 return ok({saved:true});
}
