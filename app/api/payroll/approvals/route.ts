import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export const dynamic='force-dynamic';
const roles=(a:Awaited<ReturnType<typeof access>>)=>a.user?.roles.filter(x=>x.role.active).map(x=>x.role.name)||[];
const allowed=(a:Awaited<ReturnType<typeof access>>)=>roles(a).some(r=>['Administrator','HR Manager','Finance','Finance Officer','Finance Manager'].includes(r));
export async function GET(req:NextRequest){
 try{
  const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!allowed(a))return NextResponse.json({error:'Payroll approvals access restricted to HR and Finance'},{status:403});
  const period=req.nextUrl.searchParams.get('period')||new Date().toISOString().slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return NextResponse.json({error:'Invalid period'},{status:400});
  const batches=await db.payrollCalculationBatch.findMany({where:{period},orderBy:{createdAt:'desc'},take:100,include:{approvals:{orderBy:{createdAt:'asc'}}}});
  return NextResponse.json({batches:batches.map(b=>({id:b.id,period:b.period,status:b.status,employeeCount:b.employeeCount,grossAmount:Number(b.grossAmount),netBeforeStatutory:Number(b.netBeforeStatutory),createdById:b.createdById,createdAt:b.createdAt,events:b.approvals.map(e=>({id:e.id,actorId:e.actorId,action:e.action,fromStatus:e.fromStatus,toStatus:e.toStatus,reason:e.reason,createdAt:e.createdAt}))})),viewerId:a.user.id,roles:roles(a)}, {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[payroll approvals GET]',e);return NextResponse.json({error:'Unable to load approval batches. Verify PayrollApprovalEvent migration and Railway logs.'},{status:500})}
}
