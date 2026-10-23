import {cookies} from 'next/headers';
import {createHmac,timingSafeEqual,scryptSync,randomBytes} from 'node:crypto';
import {db} from './db';
const COOKIE='fnl_session';
function secret(){const s=process.env.AUTH_SECRET;if(!s||s.length<32)throw Error('AUTH_SECRET must be at least 32 characters');return s}
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`}
export function verifyPassword(password:string,hash:string){try{const [salt,hex]=hash.split(':');const actual=scryptSync(password,salt,64),expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}}
function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url')}
export function issueToken(id:string){const body=Buffer.from(JSON.stringify({id,exp:Date.now()+8*60*60*1000})).toString('base64url');return `${body}.${sign(body)}`}
export async function setSession(id:string){(await cookies()).set(COOKIE,issueToken(id),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:8*60*60})}
export async function clearSession(){(await cookies()).delete(COOKIE)}
export async function currentUser(){try{const raw=(await cookies()).get(COOKIE)?.value;if(!raw)return null;const [body,sig]=raw.split('.');if(!body||!sig)return null;const a=Buffer.from(sig),b=Buffer.from(sign(body));if(a.length!==b.length||!timingSafeEqual(a,b))return null;const payload=JSON.parse(Buffer.from(body,'base64url').toString());if(payload.exp<Date.now())return null;return await db.user.findFirst({where:{id:payload.id,active:true},include:{roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}},scopes:true}})}catch{return null}}
export async function access(){const user=await currentUser();const keys=new Set<string>();for(const r of user?.roles||[]){if(r.role.active)for(const p of r.role.permissions)keys.add(p.permission.key)}return {user,keys,can:(key:string)=>keys.has(key)}}
export function employeeWhere(a:Awaited<ReturnType<typeof access>>){if(!a.user)return {id:'__none__'};const isGlobal=a.user.roles.some(r=>r.role.active&&(r.role.name==='Administrator'||r.role.name==='HR Manager'));if(isGlobal)return {};const scopes=a.user.scopes;const OR:any[]=[];for(const s of scopes){if(s.branchId&&s.department)OR.push({branchId:s.branchId,department:s.department});else if(s.branchId)OR.push({branchId:s.branchId});else if(s.department)OR.push({department:s.department})}if(a.user.employeeId)OR.push({id:a.user.employeeId});return OR.length?{OR}:{id:'__none__'}}
