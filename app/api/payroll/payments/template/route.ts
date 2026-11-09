import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
import {makePaymentXlsx} from '../../../../../lib/payroll-xlsx';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company selection required'},{status:403});
 if(!a.can('payroll.create'))return NextResponse.json({error:'Finance access required'},{status:403});
 const id=req.nextUrl.searchParams.get('batchId')||'';if(!id)return NextResponse.json({error:'Select a payroll batch'},{status:400});
 const b=await db.payrollCalculationBatch.findFirst({where:{id,companyId:a.companyId},include:{approvals:true}});
 if(!b||b.status!=='APPROVED')return NextResponse.json({error:'Finance-ready payroll batch required'},{status:409});
 const head=['Employee ID','Employee Number','Payment Method','Recipient Name','Account / MoMo / Cash ID','Approved Net Salary (GHS)','Payroll Batch ID'];
 const rows=[head];for(const raw of Array.isArray(b.lineItems)?b.lineItems:[]){if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const x=raw as Record<string,unknown>;if(typeof x.employeeId!=='string'||typeof x.net!=='number'||typeof x.incomeTax!=='number'||typeof x.employeeSSNIT!=='number'||typeof x.policyId!=='string')continue;rows.push([x.employeeId,String(x.employeeNo||''),'BANK','','',x.net.toFixed(2),b.id]);}
 const data=makePaymentXlsx(rows);
 return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="payroll-template-${b.period}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
