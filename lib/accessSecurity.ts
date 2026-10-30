import {access} from './auth';
import {db} from './db';

export async function securityAdmin(){
 const a=await access();
 if(!a.user)return {error:'Unauthorized',status:401} as const;
 if(!a.can('access.users.manage')&&!a.can('access.roles.manage'))return {error:'Forbidden',status:403} as const;
 return {user:a.user} as const;
}

export async function recordSecurityEvent(action:string,actorId:string|null,detail:Record<string,unknown>={}){
 try{
  await db.auditLog.create({
   data:{actorId,action,entity:'Authentication',detail:JSON.parse(JSON.stringify(detail))}
  });
 }catch(error){
  // A temporary audit-write problem should not lock staff out of HRMS.
  console.error('Security audit write failed',error);
 }
}
