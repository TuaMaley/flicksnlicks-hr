import {cookies} from 'next/headers';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {db} from './db';

/** Fail closed: never infer a tenant from client-supplied ids. */
export async function activeTenant(user:{id:string;platformAdmin:boolean}):Promise<string|null>{
 if(user.platformAdmin)return null;
 const memberships=await db.companyMembership.findMany({where:{userId:user.id,active:true,company:{active:true}},select:{companyId:true}});
 if(!memberships.length)return null;
 const raw=(await cookies()).get('nexora_active_company')?.value||'';
 const [id,sig]=raw.split('.');
 if(id&&sig){
  const secret=process.env.AUTH_SECRET;
  if(!secret||secret.length<32)throw new Error('AUTH_SECRET missing');
  const expected=createHmac('sha256',secret).update(user.id+':'+id).digest('hex');
  if(sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected))){
   return memberships.some(m=>m.companyId===id)?id:(memberships.length===1?memberships[0].companyId:null);
  }
  return memberships.length===1?memberships[0].companyId:null;
 }
 return memberships.length===1?memberships[0].companyId:null;
}
