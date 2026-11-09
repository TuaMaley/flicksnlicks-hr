import {activeTenant} from './tenant';
import {companyAccessState} from './companyAccess';
import {cookies,headers} from 'next/headers';
import {createHmac,timingSafeEqual,scryptSync,randomBytes} from 'node:crypto';
import {db} from './db';
const COOKIE='fnl_session';
const IDLE_MS=10*60*1000;

function secret(){const s=process.env.AUTH_SECRET;if(!s||s.length<32)throw Error('AUTH_SECRET must be at least 32 characters');return s}
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`}
export function verifyPassword(password:string,hash:string){try{const [salt,hex]=hash.split(':');const actual=scryptSync(password,salt,64),expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}}
function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url')}
/** Every issued token is bound to a server-side, revocable idle session. */
export async function issueToken(id:string){
 const sid=randomBytes(24).toString('hex');
 const now=new Date();
 await db.$executeRaw`INSERT INTO "NexoraIdleSession" ("id", "userId", "lastActivityAt", "createdAt") VALUES (${sid}, ${id}, ${now}, ${now})`;
 const body=Buffer.from(JSON.stringify({id,sid,exp:Date.now()+8*60*60*1000})).toString('base64url');
 return `${body}.${sign(body)}`;
}
export async function setSession(id:string){const token=await issueToken(id);(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:8*60*60})}
export async function clearSession(){
 try{const payload=await sessionPayload();if(payload?.sid)await db.$executeRaw`DELETE FROM "NexoraIdleSession" WHERE "id" = ${payload.sid}`;}catch(error){console.error('Session revoke failed',error)}
 (await cookies()).delete(COOKIE);
}
/** Mobile clients send the same signed session token as `Authorization: Bearer <token>` instead of the cookie. */
async function rawSessionToken(){const fromCookie=(await cookies()).get(COOKIE)?.value;if(fromCookie)return fromCookie;const auth=(await headers()).get('authorization')||'';return auth.startsWith('Bearer ')?auth.slice(7).trim():null}
async function sessionPayload():Promise<{id:string;sid:string;exp:number}|null>{
 try{const raw=await rawSessionToken();if(!raw)return null;const [body,sig]=raw.split('.');if(!body||!sig)return null;const a=Buffer.from(sig),b=Buffer.from(sign(body));if(a.length!==b.length||!timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString());if(typeof p.id!=='string'||typeof p.sid!=='string'||typeof p.exp!=='number'||p.exp<=Date.now())return null;return p}catch{return null}
}
export async function sessionIdentity(){
 const p=await sessionPayload();if(!p)return null;
 try{
  const rows=await db.$queryRaw<Array<{lastActivityAt:Date}>>`SELECT "lastActivityAt" FROM "NexoraIdleSession" WHERE "id"=${p.sid} AND "userId"=${p.id} LIMIT 1`;
  if(!rows.length||Date.now()-new Date(rows[0].lastActivityAt).getTime()>=IDLE_MS)return null;
  return p;
 }catch(error){console.error('Idle session validation failed',error);return null}
}
/** Called only for genuine user interaction, never from background API traffic. */
export async function touchSession(){
 const p=await sessionPayload();if(!p)return false;
 const now=new Date();const cutoff=new Date(now.getTime()-IDLE_MS);
 const changed=await db.$executeRaw`UPDATE "NexoraIdleSession" SET "lastActivityAt"=${now} WHERE "id"=${p.sid} AND "userId"=${p.id} AND "lastActivityAt">${cutoff}`;
 return changed>0;
}
export async function currentUser(){try{
 const p=await sessionIdentity();if(!p)return null;
 const user=await db.user.findFirst({where:{id:p.id,active:true},include:{roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}},scopes:true}});
 if(!user)return null;if(await companyAccessState(user)==='suspended')return null;return user;
}catch{return null}}
export async function access(){
 const user=await currentUser();
 const keys=new Set<string>();
 for(const r of user?.roles||[]){if(r.role.active)for(const p of r.role.permissions)keys.add(p.permission.key)}
 // Phase 1C.1: apply company module entitlements to legacy role permissions.
 // This does not provide row-level tenant isolation.
 if(user&&!user.platformAdmin){
  const memberships=await db.companyMembership.findMany({
   where:{userId:user.id,active:true,company:{active:true}},
   select:{companyId:true,roles:{select:{role:{select:{active:true,companyId:true,permissions:{select:{permission:{select:{key:true}}}}}}}},company:{select:{modules:{select:{moduleKey:true,enabled:true}}}}}
  });
  const companyId=await activeTenant(user);
  const company=memberships.find(m=>m.companyId===companyId);
  if(!company)keys.clear();
  else {
   // Fail closed: global legacy roles must never grant company permissions.
   // A membership without a role grants no operational permissions.
   keys.clear();
   for(const entry of company.roles){
    const role=entry.role;
    if(!role.active || (role.companyId && role.companyId!==companyId))continue;
    for(const p of role.permissions)keys.add(p.permission.key);
   }
   const enabled=new Set(company.company.modules.filter(m=>m.enabled).map(m=>m.moduleKey));
   const prefixes=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'];
   for(const key of keys){
    const module=key.split('.')[0];
    if(prefixes.includes(module)&&!enabled.has(module))keys.delete(key);
   }
  }
 }
 const companyId=user?await activeTenant(user):null;
 return {user,keys,companyId,can:(key:string)=>keys.has(key)};
}
export function employeeWhere(a:Awaited<ReturnType<typeof access>>){if(!a.user||!a.companyId)return {id:'__none__'};const tenant={companyId:a.companyId};if(a.can('employees.create'))return tenant;const scopes=a.user.scopes;const OR:any[]=[];for(const s of scopes){if(s.branchId&&s.department)OR.push({branchId:s.branchId,department:s.department});else if(s.branchId)OR.push({branchId:s.branchId});else if(s.department)OR.push({department:s.department})}if(a.user.employeeId)OR.push({id:a.user.employeeId});return OR.length?{AND:[tenant,{OR}]}:{id:'__none__'}}
