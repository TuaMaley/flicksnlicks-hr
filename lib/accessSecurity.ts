import {access,currentUser} from './auth';
import {activeTenant} from './tenant';
import {db} from './db';

export async function securityAdmin(){
 const a=await access();
 if(!a.user)return {error:'Unauthorized',status:401} as const;
 if(!a.companyId)return {error:'Active company membership required',status:403} as const;
 if(!a.can('access.users.manage')&&!a.can('access.roles.manage'))return {error:'Forbidden',status:403} as const;
 return {user:a.user} as const;
}

export async function recordSecurityEvent(action:string,actorId:string|null,detail:Record<string,unknown>={}){
 try{
  const user=actorId?await currentUser():null;
  const companyId=user&&user.id===actorId?await activeTenant(user):null;
  await db.auditLog.create({
   data:{actorId,companyId,action,entity:'Authentication',detail:JSON.parse(JSON.stringify(detail))}
  });
 }catch(error){
  // A temporary audit-write problem should not lock staff out of HRMS.
  console.error('Security audit write failed',error);
 }
}
