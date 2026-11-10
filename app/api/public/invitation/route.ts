import {NextRequest,NextResponse} from 'next/server';
import {acceptInvitation,previewInvitation} from '../../../../lib/onboarding/provision';
import {isToken} from '../../../../lib/onboarding/security';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const invalid=()=>NextResponse.json({error:'This invitation is invalid, has expired or has already been used. Ask the Nexora team to resend it.'},{status:400,headers:noStore});
export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get('token');
 if(!isToken(token))return invalid();
 const inv=await previewInvitation(token);
 return inv?NextResponse.json(inv,{headers:noStore}):invalid();
}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null);
 const password=typeof b?.password==='string'?b.password:'';
 if(!isToken(b?.token))return invalid();
 if(password.length<12||password.length>128)return NextResponse.json({error:'Use a password of 12 to 128 characters.'},{status:400,headers:noStore});
 try{
  const out=await acceptInvitation(b.token,password);
  if(!out)return invalid();
  return NextResponse.json({message:`${out.companyName} is active. Sign in with ${out.email}.`,email:out.email,companyName:out.companyName},{headers:noStore});
 }catch(e){console.error('Invitation acceptance failed',e);return NextResponse.json({error:'We could not activate the workspace. Please try again.'},{status:500,headers:noStore})}
}
