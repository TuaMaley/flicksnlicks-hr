import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export const dynamic='force-dynamic';
const roles=['Administrator','HR Manager','Finance','Finance Officer','Finance Manager'];
const number=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:0;
const cents=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
type Line=Record<string,unknown>;
export async function GET(req:NextRequest){
 try{
  const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});if(!a.companyId)return NextResponse.json({error:'Select an authorized company'},{status:403});
  if(!a.user.roles.some(r=>r.role.active&&roles.includes(r.role.name)))return NextResponse.json({error:'Payroll reporting access restricted'},{status:403});
  const period=req.nextUrl.searchParams.get('period')||new Date().toISOString().slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return NextResponse.json({error:'Invalid payroll month'},{status:400});
  const [batches,payments]=await Promise.all([
   db.payrollCalculationBatch.findMany({where:{period,status:'APPROVED',companyId:a.companyId},select:{id:true,createdAt:true,employeeCount:true,lineItems:true,approvals:{select:{action:true}}},orderBy:{createdAt:'desc'}}),
   db.payrollPayment.findMany({where:{period,companyId:a.companyId},select:{id:true,batchId:true,employeeId:true,status:true,netAmount:true,method:true,branch:true,reference:true}})
  ]);
  const approved=batches.filter(b=>b.approvals.some(e=>e.action==='finance_approve'));
  const selected=new Map<string,{batchId:string;line:Line}>();let overlaps=0,invalid=0;
  for(const batch of approved){if(!Array.isArray(batch.lineItems)){invalid++;continue;}
   for(const item of batch.lineItems){if(!item||typeof item!=='object'||Array.isArray(item)){invalid++;continue;}
    const l=item as Line,id=l.employeeId;
    if(typeof id!=='string'||!id){invalid++;continue;}
    if(selected.has(id)){overlaps++;continue;}
    selected.set(id,{batchId:batch.id,line:l});
   }
  }
  const rows=Array.from(selected.entries()).map(([employeeId,{batchId,line:l}])=>{
   const complete=typeof l.policyId==='string'&&typeof l.net==='number'&&typeof l.incomeTax==='number'&&typeof l.employeeSSNIT==='number';
   const payment=payments.find(p=>p.employeeId===employeeId&&p.batchId===batchId);
   return {employeeId,batchId,employeeNo:String(l.employeeNo||''),name:String(l.name||'Employee'),branch:String(l.branch||'Unassigned'),position:String(l.position||''),complete,
    basic:number(l.basic),allowances:number(l.allowances),overtimeDays:number(l.overtimeDays),overtimePay:number(l.overtimePay),absenceDeduction:number(l.absenceDeduction),gross:number(l.gross),incomeTax:number(l.incomeTax),employeeSSNIT:number(l.employeeSSNIT),employerPension:number(l.employerPension),tier1Total:number(l.tier1Total),tier2Total:number(l.tier2Total),tier3Employee:number(l.tier3Employee),otherDeductions:number(l.otherDeductions),deductions:number(l.deductions),net:number(l.net),employerTotalCost:number(l.employerTotalCost),paymentStatus:payment?.status||'NOT_SCHEDULED',paymentMethod:payment?.method||'',paymentReference:payment?.reference||''};
  });
  const totals={employees:rows.length,complete:rows.filter(r=>r.complete).length,gross:0,net:0,paye:0,employeeSSNIT:0,employerPension:0,tier1Total:0,tier2Total:0,tier3Employee:0,otherDeductions:0,overtimePay:0,absenceDeduction:0,employerTotalCost:0,paid:0,outstanding:0};
  for(const r of rows){if(!r.complete)continue;for(const key of ['gross','net','incomeTax','employeeSSNIT','employerPension','tier1Total','tier2Total','tier3Employee','otherDeductions','overtimePay','absenceDeduction','employerTotalCost'] as const){const target=key==='incomeTax'?'paye':key;totals[target]+=r[key];}if(r.paymentStatus==='PAID')totals.paid+=r.net;else totals.outstanding+=r.net;}
  for(const k of Object.keys(totals) as (keyof typeof totals)[]){totals[k]=cents(totals[k]);}
  const byBranch=Array.from(new Set(rows.map(r=>r.branch))).sort().map(branch=>{const list=rows.filter(r=>r.branch===branch&&r.complete);return {branch,employees:list.length,gross:cents(list.reduce((s,r)=>s+r.gross,0)),net:cents(list.reduce((s,r)=>s+r.net,0)),paid:cents(list.filter(r=>r.paymentStatus==='PAID').reduce((s,r)=>s+r.net,0)),employerCost:cents(list.reduce((s,r)=>s+r.employerTotalCost,0))};});
  return NextResponse.json({period,totals,rows,byBranch,batchCount:approved.length,overlaps,invalid,excludedIncomplete:rows.length-totals.complete,notice:'Read-only management report. Latest Finance-approved batch per employee is selected to prevent double-counting; overlapping batches require reconciliation. Payments are recorded manually, not bank-confirmed automatically. Statutory figures reflect stored payroll snapshots, not an independently verified tax return.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[payroll reports GET]',e);return NextResponse.json({error:'Unable to load payroll reports'},{status:500});}
}
