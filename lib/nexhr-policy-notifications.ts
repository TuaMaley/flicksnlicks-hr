import {db} from './db';
import {notifyUser} from './notifications';
/** Notify active members only for currently effective, employee-visible policies. */
export async function notifyApprovedNexHrPolicy(input:{companyId:string;documentId:string;title:string;version:number;actorId:string;effectiveAt:Date|null;expiresAt:Date|null}){
 const now=new Date();
 if(input.effectiveAt&&input.effectiveAt>now)return {sent:0,reason:'future_effective'};
 if(input.expiresAt&&input.expiresAt<=now)return {sent:0,reason:'expired'};
 const members=await db.companyMembership.findMany({where:{companyId:input.companyId,active:true,user:{active:true}},select:{userId:true},take:5000});
 const recipients=[...new Set(members.map(m=>m.userId))].filter(id=>id!==input.actorId);
 let sent=0;
 // Bounded batches; do not log or disclose recipient information in notification text.
 for(let i=0;i<recipients.length;i+=25){
  const results=await Promise.allSettled(recipients.slice(i,i+25).map(userId=>notifyUser({userId,companyId:input.companyId,title:'HR policy approved',message:`${input.title.slice(0,100)} (v${input.version}) is now available in Nex HR.`,href:'/nex-hr',kind:'HR_POLICY'})));
  sent+=results.filter(r=>r.status==='fulfilled').length;
 }
 return {sent};
}
