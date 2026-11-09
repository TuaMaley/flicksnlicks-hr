import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {verifyPassword,issueToken} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
import {recordSecurityEvent} from '../../../../lib/accessSecurity';
import {activeTenant} from '../../../../lib/tenant';
import {companyAccessState,SUSPENDED_COMPANY_MESSAGE} from '../../../../lib/companyAccess';
export const runtime='nodejs';
/**
 * Mobile sign-in for the Nexora Employee app.
 * Identical checks to /api/auth/login, but returns the signed session token in the body
 * (for Authorization: Bearer) instead of setting the browser cookie. Absolute token lifetime: 8 h; idle timeout: 10 minutes.
 */
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);
  const email=body?.email,password=body?.password;
  if(typeof email!=='string'||typeof password!=='string'){await recordSecurityEvent('LOGIN_FAILURE',null,{reason:'invalid_credentials',client:'mobile'});return fail('Invalid credentials',401)}
  const user=await db.user.findUnique({where:{email:email.trim().toLowerCase()},select:{id:true,active:true,passwordHash:true,name:true,email:true,employeeId:true,platformAdmin:true}});
  if(!user||!user.active||!verifyPassword(password,user.passwordHash)){await recordSecurityEvent('LOGIN_FAILURE',null,{reason:'invalid_credentials',client:'mobile'});return fail('Invalid credentials',401)}
  if(await companyAccessState(user)==='suspended')return fail(SUSPENDED_COMPANY_MESSAGE,403);
  if(!user.employeeId)return fail('This login is not linked to an employee record. The employee app is for staff accounts only.',403);
  const token=await issueToken(user.id);
  const memberships=await db.companyMembership.findMany({where:{userId:user.id,active:true,company:{active:true}},select:{companyId:true,company:{select:{name:true,code:true}}}});
  try{const companyId=await activeTenant({id:user.id,platformAdmin:user.platformAdmin});await db.auditLog.create({data:{actorId:user.id,companyId,action:'LOGIN',entity:'User',entityId:user.id,detail:{client:'mobile'}}})}catch(error){console.error('Mobile login audit write failed',error)}
  await recordSecurityEvent('LOGIN_SUCCESS',user.id,{method:'password',client:'mobile'},null);
  return ok({token,expiresAt:Date.now()+8*60*60*1000,user:{name:user.name,email:user.email},companies:memberships.map(m=>({id:m.companyId,name:m.company.name,code:m.company.code}))});
 }catch(error){console.error('Mobile login failed',error);return fail('Unable to sign in',500)}
}
