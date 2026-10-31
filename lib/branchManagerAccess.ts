import {access} from './auth';
import {db} from './db';
import {fail} from './http';

/** Company-scoped HR or Administrator membership required for branch management. */
export async function branchManagerAccess(){
  const a=await access();
  if(!a.user)return {error:fail('Unauthorized',401)};
  if(!a.companyId)return {error:fail('Select an authorized company',403)};
  const member=await db.companyMembership.findFirst({
    where:{companyId:a.companyId,userId:a.user.id,active:true},
    include:{roles:{include:{role:true}}}
  });
  const permitted=member?.roles.some(({role})=>{
    if(!role.active || role.companyId!==a.companyId)return false;
    const name=role.name.replace(/ \[cm[a-z0-9]+\]$/i,'').trim().toLowerCase();
    return name==='administrator'||name==='hr manager';
  });
  if(!permitted)return {error:fail('Company HR Manager or Administrator access required',403)};
  return {a};
}
