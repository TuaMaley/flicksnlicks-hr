import {NextRequest,NextResponse} from 'next/server';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const dynamic='force-dynamic';
const allowed=['Administrator','HR Manager','Finance','Finance Officer','Finance Manager'];
const num=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:0;
const round=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
export async function GET(req:NextRequest){
 try{
  const a=await access();if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!a.user.roles.some(r=>r.role.active&&allowed.includes(r.role.name)))return NextResponse.json({error:'Reporting access restricted'},{status:403});
  const period=req.nextUrl.searchParams.get('period')||'';
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return NextResponse.json({error:'Invalid period'},{status:400});
  const [year,month]=period.split('-').map(Number);
  const months=Array.from({length:6},(_,i)=>{const d=new Date(Date.UTC(year,month-1-(5-i),1));return d.toISOString().slice(0,7)});
  const batches=await db.payrollCalculationBatch.findMany({where:{period:{in:months},status:'APPROVED'},select:{id:true,period:true,createdAt:true,lineItems:true,approvals:{select:{action:true}}},orderBy:{createdAt:'desc'}});
  const result=months.map(p=>{
   const seen=new Set<string>();let gross=0,net=0,employerCost=0,paye=0,ssnit=0,complete=0,overlaps=0;
   for(const b of batches){if(b.period!==p||!b.approvals.some(e=>e.action==='finance_approve')||!Array.isArray(b.lineItems))continue;
    for(const raw of b.lineItems){if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
     const l=raw as Record<string,unknown>;const id=l.employeeId;if(typeof id!=='string'||!id)continue;
     if(seen.has(id)){overlaps++;continue;}seen.add(id);
     if(typeof l.policyId!=='string'||typeof l.net!=='number'||typeof l.incomeTax!=='number'||typeof l.employeeSSNIT!=='number')continue;
     complete++;gross+=num(l.gross);net+=num(l.net);employerCost+=num(l.employerTotalCost);paye+=num(l.incomeTax);ssnit+=num(l.employeeSSNIT);
    }
   }
   return {period:p,employees:complete,gross:round(gross),net:round(net),employerCost:round(employerCost),paye:round(paye),ssnit:round(ssnit),overlaps};
  });
  return NextResponse.json({months:result,notice:'Historical figures are read-only saved Finance-approved payroll snapshots. Months with no eligible records display zero; zero does not establish that no payroll occurred.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[payroll trends GET]',e);return NextResponse.json({error:'Unable to load payroll trends'},{status:500});}
}
