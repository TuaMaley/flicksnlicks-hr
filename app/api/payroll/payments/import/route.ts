import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
import {readPaymentXlsx} from '../../../../../lib/payroll-xlsx';
export const dynamic='force-dynamic';
const validPeriod=(p:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(p);
const validAmount=(v:string)=>/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(v);
const toCents=(v:string)=>Math.round(Number(v)*100);
function finance(a:Awaited<ReturnType<typeof access>>){return !!a.user?.roles.some(r=>r.role.active&&['Administrator','Finance','Finance Officer','Finance Manager'].includes(r.role.name))}
export async function POST(req:NextRequest){
 try{
  const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});if(!finance(a))return NextResponse.json({error:'Finance access required'},{status:403});
  const form=await req.formData(),file=form.get('file'),period=String(form.get('period')||''),batchId=String(form.get('batchId')||''),mode=String(form.get('mode')||'preview');
  if(!validPeriod(period)||!batchId||!['preview','prepare'].includes(mode))return NextResponse.json({error:'Invalid month, batch or action'},{status:400});
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx')||file.size>1_000_000||file.size<100)return NextResponse.json({error:'Upload a valid .xlsx file under 1 MB'},{status:400});
  const rows=readPaymentXlsx(Buffer.from(await file.arrayBuffer()));if(!rows.length)return NextResponse.json({error:'The spreadsheet contains no employees'},{status:400});
  const batch=await db.payrollCalculationBatch.findUnique({where:{id:batchId},include:{approvals:true}});
  if(!batch||batch.period!==period||batch.status!=='APPROVED'||!batch.approvals.some(x=>x.action==='finance_approve'))return NextResponse.json({error:'Finance-approved payroll batch required'},{status:409});
  const snapshots=Array.isArray(batch.lineItems)?batch.lineItems:[];const expected=new Map<string,{employeeNo:string;amount:number}>();
  for(const raw of snapshots){if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const x=raw as Record<string,unknown>;if(typeof x.employeeId==='string'&&typeof x.net==='number'&&Number.isFinite(x.net)&&typeof x.incomeTax==='number'&&typeof x.employeeSSNIT==='number'&&typeof x.policyId==='string')expected.set(x.employeeId,{employeeNo:String(x.employeeNo||''),amount:Math.round(x.net*100)});}
  const existing=await db.payrollPayment.findMany({where:{period,employeeId:{in:rows.map(r=>r.employeeId)}},select:{employeeId:true,status:true}});
  const occupied=new Set(existing.map(x=>x.employeeId));const seen=new Set<string>();
  const checked=rows.map(r=>{
   const issues:string[]=[];const target=expected.get(r.employeeId);
   if(!target)issues.push('Employee not in this batch with complete statutory calculations');
   if(seen.has(r.employeeId))issues.push('Duplicate employee in spreadsheet');seen.add(r.employeeId);
   if(occupied.has(r.employeeId))issues.push('Employee already has a payment obligation for this month');
   if(r.batchId!==batchId)issues.push('Payroll batch ID mismatch');
   if(target&&r.employeeNo!==target.employeeNo)issues.push('Employee number mismatch');
   if(!['BANK','MOMO','CASH'].includes(r.method))issues.push('Payment method must be BANK, MOMO or CASH');
   if(r.recipient.length<3||r.recipient.length>120)issues.push('Recipient name required (3–120 characters)');
   if(r.destination.length<4||r.destination.length>160)issues.push('Payment destination required (4–160 characters)');
   if(!validAmount(r.amount)||target&&toCents(r.amount)!==target.amount)issues.push('Amount must exactly match approved net salary');
   return {row:r.row,employeeNo:r.employeeNo,employeeId:r.employeeId,valid:issues.length===0,issues,amount:r.amount};
  });
  if(mode==='preview')return NextResponse.json({total:rows.length,valid:checked.filter(x=>x.valid).length,invalid:checked.filter(x=>!x.valid).length,rows:checked,notice:'Preview only. No payments created and no money transferred.'},{headers:{'Cache-Control':'private, no-store'}});
  if(checked.some(x=>!x.valid))return NextResponse.json({error:'Upload has invalid rows. Correct them and preview again.',rows:checked},{status:409});
  const result=await db.$transaction(async tx=>{
   // Serialize concurrent uploads for the same payroll month within PostgreSQL.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${period}))`;
   const already=await tx.payrollPayment.count({where:{period,employeeId:{in:rows.map(r=>r.employeeId)}}});
   if(already)return {error:'One or more employees already have payment records. Refresh and revalidate.',status:409};
   for(const r of rows){const snapshot=snapshots.find((x:any)=>x?.employeeId===r.employeeId) as Record<string,unknown>;
    const payment=await tx.payrollPayment.create({data:{batchId,period,employeeId:r.employeeId,employeeNo:r.employeeNo,employeeName:String(snapshot.name||'Employee'),branch:String(snapshot.branch||''),netAmount:Number(r.amount),currency:'GHS',method:r.method,recipientName:r.recipient,paymentDestination:r.destination,preparedById:a.user!.id}});
    await tx.payrollPaymentEvent.create({data:{paymentId:payment.id,actorId:a.user!.id,action:'IMPORT_PREPARE',toStatus:'PENDING',detail:{source:'XLSX',row:r.row,method:r.method,destinationLast4:r.destination.slice(-4)}}});
   }
   return {created:rows.length};
  });
  if('error'in result)return NextResponse.json({error:result.error},{status:result.status});
  return NextResponse.json({...result,notice:'Payment obligations prepared. Independent verification is still required. No money has been transferred.'},{status:201});
 }catch(e){console.error('[payroll XLSX import]',e);return NextResponse.json({error:e instanceof Error&&(/XLSX|Spreadsheet|template|worksheet|safe limits|Maximum|Corrupted|Truncated|archive/.test(e.message))?e.message:'Unable to process Excel file'},{status:400})}
}
