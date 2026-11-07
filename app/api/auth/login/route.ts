import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {verifyPassword,setSession} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
import {recordSecurityEvent} from '../../../../lib/accessSecurity';
import {activeTenant} from '../../../../lib/tenant';
import {companyAccessState,SUSPENDED_COMPANY_MESSAGE} from '../../../../lib/companyAccess';

export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);
  const email=body?.email,password=body?.password;
  if(typeof email!=='string'||typeof password!=='string'){
   await recordSecurityEvent('LOGIN_FAILURE',null,{reason:'invalid_credentials'});
   return fail('Invalid credentials',401);
  }
  const user=await db.user.findUnique({where:{email:email.trim().toLowerCase()}});
  if(!user||!user.active||!verifyPassword(password,user.passwordHash)){
   await recordSecurityEvent('LOGIN_FAILURE',null,{reason:'invalid_credentials'});
   return fail('Invalid credentials',401);
  }
  if(await companyAccessState(user)==='suspended'){
   await recordSecurityEvent('LOGIN_FAILURE',user.id,{reason:'company_suspended'});
   return fail(SUSPENDED_COMPANY_MESSAGE,403);
  }
  await setSession(user.id);
  // Preserve the existing login audit entry used by other HRMS features.
  try{const companyId=await activeTenant(user);await db.auditLog.create({data:{actorId:user.id,companyId,action:'LOGIN',entity:'User',entityId:user.id}})}
  catch(error){console.error('Existing login audit write failed',error)}
  await recordSecurityEvent('LOGIN_SUCCESS',user.id,{method:'password'});
  return ok({success:true});
 }catch(error){
  console.error('Login request failed',error);
  return fail('Unable to sign in',500);
 }
}
