import {NextRequest,NextResponse} from 'next/server';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const clean=(v:unknown)=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E]/g,'');
export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.companyId||!a.can('selfservice.view')||!a.user.employeeId)return NextResponse.json({error:'Forbidden'},{status:403});
  const batchId=req.nextUrl.searchParams.get('batchId');
  if(!batchId)return NextResponse.json({error:'Missing payroll batch'},{status:400});
  const batch=await db.payrollCalculationBatch.findFirst({where:{id:batchId,companyId:a.companyId,status:'APPROVED'},select:{id:true,period:true,currency:true,lineItems:true,approvals:{select:{action:true}}}});
  if(!batch||!batch.approvals.some(x=>x.action==='finance_approve'))return NextResponse.json({error:'Payslip not finalized'},{status:404});
  const payment=await db.payrollPayment.findFirst({where:{companyId:a.companyId,employeeId:a.user.employeeId,batchId:batch.id,status:'PAID',confirmedAt:{not:null}},select:{id:true,reference:true,confirmedAt:true}});
  if(!payment)return NextResponse.json({error:'Payment not yet confirmed'},{status:404});
  const raw=(Array.isArray(batch.lineItems)?batch.lineItems:[]).find(x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(x as Record<string,unknown>).employeeId===a.user!.employeeId);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return NextResponse.json({error:'Payslip not found'},{status:404});
  const x=raw as Record<string,unknown>;
  const required=['basic','allowances','overtimePay','gross','absenceDeduction','incomeTax','employeeSSNIT','tier3Employee','otherDeductions','net'];
  if(!required.every(k=>typeof x[k]==='number'&&Number.isFinite(x[k])))return NextResponse.json({error:'Incomplete statutory payroll breakdown; contact HR'},{status:409});
  const company=await db.company.findUnique({where:{id:a.companyId},select:{name:true,email:true,phone:true}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});
  const doc=await PDFDocument.create(),page=doc.addPage([595,842]);
  const normal=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.12,.17,.24),muted=rgb(.37,.42,.48),rule=rgb(.83,.86,.89);
  const text=(v:unknown,y:number,size=10,heavy=false,left=48)=>page.drawText(clean(v),{x:left,y,size,font:heavy?bold:normal,color:ink});
  const money=(v:unknown)=>clean(batch.currency)+' '+Number(v).toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const line=(y:number)=>page.drawLine({start:{x:48,y},end:{x:547,y},thickness:.8,color:rule});
  text(company.name.toUpperCase(),785,18,true);
  if(company.email)text('Email: '+company.email,765,9);
  if(company.phone)text('Telephone: '+company.phone,750,9);
  line(734);text('EMPLOYEE PAYSLIP',706,15,true);
  text('Payroll period: '+batch.period,682,10);
  text('Employee: '+clean(x.name),661,10);
  text('Employee ID: '+clean(x.employeeNo),644,10);
  text('Position: '+clean(x.position),627,10);
  text('Branch: '+clean(x.branch),610,10);
  line(593);text('EARNINGS',573,11,true);
  const entries:[string,string][]=[['Basic salary',money(x.basic)],['Allowances',money(x.allowances)],['Overtime pay',money(x.overtimePay)],['GROSS EARNINGS',money(x.gross)],['DEDUCTIONS',''],['Absence deduction',money(x.absenceDeduction)],['Employee SSNIT',money(x.employeeSSNIT)],['Income tax (PAYE)',money(x.incomeTax)],['Tier 3 employee contribution',money(x.tier3Employee)],['Other deductions',money(x.otherDeductions)],['NET PAY',money(x.net)]];
  let y=549;
  for(const [label,value] of entries){
    const isHeading=label==='DEDUCTIONS',heavy=isHeading||label==='GROSS EARNINGS'||label==='NET PAY';
    if(heavy)line(y+10);
    text(label,y,10,heavy);
    if(value){const f=heavy?bold:normal;page.drawText(value,{x:547-f.widthOfTextAtSize(value,10),y,size:10,font:f,color:ink});}
    y-=isHeading?29:30;
  }
  line(179);
  text('Payment reference: '+clean(payment.reference||payment.id),158,9);
  text('Payment confirmed: '+(payment.confirmedAt?payment.confirmedAt.toISOString().slice(0,10):'N/A'),142,9);
  text('This payslip reflects the approved payroll calculation for the stated period.',106,9);
  line(68);text('Payslip reference: '+clean(batch.id)+' / '+clean(a.user.employeeId),51,8);
  const bytes=await doc.save();
  return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Payslip-'+batch.period+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('ESS payslip PDF',e);return NextResponse.json({error:'Unable to generate payslip'},{status:500});}
}
