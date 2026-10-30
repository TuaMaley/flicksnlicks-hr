import {cookies} from 'next/headers';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {currentUser} from './auth';
import {db} from './db';
const KEY='nexora_active_company';
function sign(value:string){const secret=process.env.AUTH_SECRET;if(!secret||secret.length<32)throw Error('AUTH_SECRET is missing');return createHmac('sha256',secret).update(value).digest('hex')}
export async function selectedCompany(){
 const user=await currentUser();if(!user||user.platformAdmin)return null;
 const memberships=await db.companyMembership.findMany({where:{userId:user.id,active:true,company:{active:true}},include:{company:{select:{id:true,name:true,code:true}},roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}}});
 const raw=(await cookies()).get(KEY)?.value||'';
 const [companyId,signature]=raw.split('.');
 const expected=companyId?sign(user.id+':'+companyId):'';
 const valid=signature&&signature.length===expected.length&&timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
 const membership=valid?memberships.find(m=>m.companyId===companyId):null;
 return {user,memberships,selected:membership||null};
}
export async function chooseCompany(companyId:string){
 const state=await selectedCompany();
 if(!state||!state.memberships.some(m=>m.companyId===companyId))return false;
 (await cookies()).set(KEY,companyId+'.'+sign(state.user.id+':'+companyId),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:8*60*60});
 return true;
}
