import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';

export async function GET(){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});if(!a.companyId)return NextResponse.json({error:'Select an authorized company'},{status:403});
  if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});
  if(!a.user.employeeId)return NextResponse.json({error:'Your account is not linked to an employee record. Contact HR.'},{status:403});
  // Only confirmed payments for the signed-in employee; never expose other employees or destination details.
  const rows=await db.payrollPayment.findMany({
   where:{companyId:a.companyId,employeeId:a.user.employeeId,status:'CONFIRMED',confirmedAt:{not:null}},
   select:{id:true,period:true,netAmount:true,currency:true,method:true,status:true,confirmedAt:true,reference:true},
   orderBy:[{confirmedAt:'desc'},{period:'desc'}],take:60
  });
  const batches=await db.payrollCalculationBatch.findMany({where:{companyId:a.companyId,status:'APPROVED'},orderBy:{createdAt:'desc'},take:120,select:{id:true,period:true,currency:true,lineItems:true,approvals:{select:{action:true}}}});
  const confirmedPeriods=new Set(rows.map(p=>p.period));
  const payslips=batches.flatMap(b=>{
    if(!confirmedPeriods.has(b.period)||!b.approvals.some(x=>x.action==='finance_approve'))return [];
    const item=(Array.isArray(b.lineItems)?b.lineItems:[]).find(raw=>!!raw&&typeof raw==='object'&&!Array.isArray(raw)&&(raw as Record<string,unknown>).employeeId===a.user!.employeeId);
    if(!item||typeof item!=='object'||Array.isArray(item))return [];
    const x=item as Record<string,unknown>;
    if(!['gross','net','employeeSSNIT','incomeTax'].every(k=>typeof x[k]==='number'&&Number.isFinite(x[k])))return [];
    return [{batchId:b.id,period:b.period,currency:b.currency,gross:Number(x.gross),net:Number(x.net),ready:true}];
  });
  return NextResponse.json({payments:rows.map(p=>({...p,netAmount:p.netAmount.toString()})),payslips},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('ESS payslips',e);return NextResponse.json({error:'Unable to load payroll history'},{status:500})}
}
