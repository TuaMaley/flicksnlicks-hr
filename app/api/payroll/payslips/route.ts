import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export const dynamic='force-dynamic';
const periodOK=(p:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(p);
const money=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const roles=(a:Awaited<ReturnType<typeof access>>)=>a.user?.roles.filter(x=>x.role.active).map(x=>x.role.name)||[];
export async function GET(req:NextRequest){
 try{
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!roles(a).some(r=>['Administrator','HR Manager','Finance','Finance Officer','Finance Manager'].includes(r)))return NextResponse.json({error:'Payslip access is restricted to HR and Finance'},{status:403});
 const period=req.nextUrl.searchParams.get('period')||new Date().toISOString().slice(0,7);
 if(!periodOK(period))return NextResponse.json({error:'Invalid payroll month'},{status:400});
 const batches=await db.payrollCalculationBatch.findMany({where:{period,status:'APPROVED'},orderBy:{createdAt:'desc'},take:30,select:{id:true,period:true,status:true,createdAt:true,currency:true,lineItems:true,employeeCount:true,approvals:{select:{action:true,createdAt:true},orderBy:{createdAt:'asc'}}}});
 const rows=batches.map(b=>{
 const items=Array.isArray(b.lineItems)?b.lineItems:[];
 const finalReview=b.approvals.some(x=>x.action==='finance_approve');
 const payslips=items.flatMap((raw,index)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return [];
  const x=raw as Record<string,unknown>;
  const id=typeof x.employeeId==='string'?x.employeeId:'';
  if(!id)return [];
  const hasStatutory=['gross','net','employeeSSNIT','incomeTax','employerPension','policyId'].every(k=>k==='policyId'?typeof x[k]==='string':money(x[k])!==null);
  const basic=money(x.basic),allowances=money(x.allowances),overtimePay=money(x.overtimePay),gross=money(x.gross),absenceDeduction=money(x.absenceDeduction),incomeTax=money(x.incomeTax),employeeSSNIT=money(x.employeeSSNIT),tier3Employee=money(x.tier3Employee),otherDeductions=money(x.otherDeductions),employerPension=money(x.employerPension),net=money(x.net);
  return [{id:b.id+':'+index,employeeId:id,employeeNo:typeof x.employeeNo==='string'?x.employeeNo:'',name:typeof x.name==='string'?x.name:'Employee',branch:typeof x.branch==='string'?x.branch:'',position:typeof x.position==='string'?x.position:'',category:typeof x.category==='string'?x.category:'',basic,allowances,overtimeDays:money(x.overtimeDays),overtimeRate:money(x.overtimeRate),overtimePay,absenceDeduction,gross,incomeTax,employeeSSNIT,tier3Employee,otherDeductions,employerPension,net,policyId:typeof x.policyId==='string'?x.policyId:null,ready:hasStatutory&&finalReview,reason:!finalReview?'Missing Finance approval event':!hasStatutory?'Legacy/preliminary calculation: statutory breakdown unavailable':null}];
 });
 return {id:b.id,period:b.period,createdAt:b.createdAt,currency:b.currency,employeeCount:b.employeeCount,payslips};
 });
 return NextResponse.json({period,batches:rows},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[payslips GET]',e);return NextResponse.json({error:'Unable to load payslips. Review payroll database and server logs.'},{status:500})}
}
