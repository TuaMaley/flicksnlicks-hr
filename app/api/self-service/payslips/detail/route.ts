import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const dynamic='force-dynamic';
const money=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const str=(v:unknown)=>typeof v==='string'?v:'';
/**
 * GET /api/self-service/payslips/detail?batchId=
 * Returns the signed-in employee's own saved payroll line for one finalized batch, in the same shape the
 * HR "Payslip preview" (app/payroll/payslips) renders, so the employee app can show the identical payslip.
 * Eligibility is exactly that of /api/self-service/payslips/pdf: APPROVED batch, Finance approval event,
 * and a confirmed PAID payment for this employee. No amounts are recalculated here.
 */
export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.companyId||!a.can('selfservice.view')||!a.user.employeeId)return NextResponse.json({error:'Forbidden'},{status:403});
  const batchId=req.nextUrl.searchParams.get('batchId');
  if(!batchId)return NextResponse.json({error:'Missing payroll batch'},{status:400});
  const batch=await db.payrollCalculationBatch.findFirst({where:{id:batchId,companyId:a.companyId,status:'APPROVED'},select:{id:true,period:true,currency:true,lineItems:true,approvals:{select:{action:true}}}});
  if(!batch||!batch.approvals.some(x=>x.action==='finance_approve'))return NextResponse.json({error:'Payslip not finalized'},{status:404});
  const payment=await db.payrollPayment.findFirst({where:{companyId:a.companyId,employeeId:a.user.employeeId,batchId:batch.id,status:'PAID',confirmedAt:{not:null}},select:{reference:true,confirmedAt:true,method:true}});
  if(!payment)return NextResponse.json({error:'Payment not yet confirmed'},{status:404});
  const items=Array.isArray(batch.lineItems)?batch.lineItems:[];
  const index=items.findIndex(x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(x as Record<string,unknown>).employeeId===a.user!.employeeId);
  if(index<0)return NextResponse.json({error:'Payslip not found'},{status:404});
  const x=items[index] as Record<string,unknown>;
  const required=['basic','allowances','overtimePay','gross','absenceDeduction','incomeTax','employeeSSNIT','tier3Employee','otherDeductions','net'];
  if(!required.every(k=>money(x[k])!==null))return NextResponse.json({error:'Incomplete statutory payroll breakdown; contact HR'},{status:409});
  const company=await db.company.findUnique({where:{id:a.companyId},select:{name:true,logoDataUrl:true}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});
  return NextResponse.json({
   company:{name:company.name,logoDataUrl:company.logoDataUrl},
   batch:{id:batch.id,period:batch.period,currency:batch.currency},
   payment:{reference:payment.reference,confirmedAt:payment.confirmedAt,method:payment.method},
   slip:{
    id:batch.id+':'+index,employeeNo:str(x.employeeNo),name:str(x.name),branch:str(x.branch),position:str(x.position),category:str(x.category),
    basic:money(x.basic),allowances:money(x.allowances),overtimeDays:money(x.overtimeDays),overtimeRate:money(x.overtimeRate),overtimePay:money(x.overtimePay),
    absenceDeduction:money(x.absenceDeduction),gross:money(x.gross),incomeTax:money(x.incomeTax),employeeSSNIT:money(x.employeeSSNIT),tier3Employee:money(x.tier3Employee),
    otherDeductions:money(x.otherDeductions),employerPension:money(x.employerPension),net:money(x.net),ready:true,
   },
  },{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('ESS payslip detail',e);return NextResponse.json({error:'Unable to load payslip'},{status:500})}
}
