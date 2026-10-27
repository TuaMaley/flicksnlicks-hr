import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
import {trainingData} from '../../../../lib/training-data';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('training.edit'))return fail('Forbidden',403);
 const {id}=await params;
 try{const existing=await db.training.findUnique({where:{id}});if(!existing)return fail('Training not found',404);
 const incoming=await req.json();const data=trainingData({...existing,...incoming,startDate:incoming.startDate!==undefined?incoming.startDate:existing.startDate?.toISOString().slice(0,10)??null,endDate:incoming.endDate!==undefined?incoming.endDate:existing.endDate?.toISOString().slice(0,10)??null});
 const training=await db.$transaction(async tx=>{const updated=await tx.training.update({where:{id},data});await tx.auditLog.create({data:{actorId:a.user!.id,action:'TRAINING_UPDATED',entity:'Training',entityId:id,detail:{fields:Object.keys(incoming)}}});return updated});return ok({training});
 }catch(e:any){if(e?.code==='P2002')return fail('Training code already exists',409);if(e instanceof SyntaxError)return fail('Invalid JSON',400);if(e?.message?.startsWith('Invalid')||e?.message?.includes('required')||e?.message?.includes('must')||e?.message?.includes('requires'))return fail(e.message,400);console.error('Training update failed',e);return fail('Unable to update training',500)}
}
