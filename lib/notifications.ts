import {db} from './db';
import {randomUUID} from 'node:crypto';

/** Persist an event for an explicitly authorized recipient in the same tenant. */
export async function notifyUser(input:{userId:string;companyId:string|null;title:string;message:string;href:string;kind?:string}){
 if(!input.userId||!input.title||!input.href.startsWith('/')||input.href.startsWith('//'))return;
 await db.$executeRaw`
 INSERT INTO "NexoraNotification" ("id","userId","companyId","title","message","href","kind","createdAt")
 VALUES (${randomUUID()},${input.userId},${input.companyId},${input.title.slice(0,160)},${input.message.slice(0,1000)},${input.href.slice(0,500)},${(input.kind||'GENERAL').slice(0,40)},CURRENT_TIMESTAMP)
 `;
}

/** Notify company members with a permission, avoiding cross-company delivery. */
export async function notifyCompanyPermission(input:{companyId:string;permission:string;title:string;message:string;href:string;excludeUserId?:string}){
 const members=await db.companyMembership.findMany({where:{companyId:input.companyId,active:true,company:{active:true}},select:{userId:true,roles:{select:{role:{select:{active:true,permissions:{select:{permission:{select:{key:true}}}}}}}}}});
 const ids=[...new Set(members.filter(m=>m.userId!==input.excludeUserId&&m.roles.some(r=>r.role.active&&r.role.permissions.some(p=>p.permission.key===input.permission))).map(m=>m.userId))];
 await Promise.allSettled(ids.map(userId=>notifyUser({userId,companyId:input.companyId,title:input.title,message:input.message,href:input.href,kind:'ACTION'})));
}
