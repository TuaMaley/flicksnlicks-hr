import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return fail('Unauthorized',401);
  if(!a.can('onboarding.view')||!a.can('onboarding.approve'))return fail('Forbidden',403);
  const p=req.nextUrl.searchParams;
  const start=p.get('start')||'',end=p.get('end')||'';
  const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
  if((start&&!valid(start))||(end&&!valid(end))||(start&&end&&start>end))return fail('Invalid date range',400);
  const dateWhere:any={};if(start||end)dateWhere.createdAt={...(start?{gte:new Date(start+'T00:00:00.000Z')}:{ }),...(end?{lte:new Date(end+'T23:59:59.999Z')}:{ })};
  const scope=employeeWhere(a);
  const [onboarding,exits]=await Promise.all([
   db.onboardingCase.findMany({where:{kind:'ONBOARDING',employee:scope,...dateWhere},select:{id:true,status:true,createdAt:true,employee:{select:{department:true,branch:{select:{name:true}}}},tasks:{select:{completed:true,category:true,completedAt:true}}}}),
   db.employeeExitCase.findMany({where:{employee:scope,...dateWhere},select:{id:true,status:true,reason:true,createdAt:true,approvedAt:true,employee:{select:{department:true,branch:{select:{name:true}}}},tasks:{select:{completed:true,category:true}}}})
  ]);
  return ok({onboarding,exits});
 }catch(e){console.error('Onboarding analytics GET failed',e);return fail('Unable to load analytics',500)}
}
