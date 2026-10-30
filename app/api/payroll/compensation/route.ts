import {NextRequest,NextResponse} from 'next/server';
import {compensationAccess,moneyParts,scopedEmployee,db} from './helpers';
export async function GET(req:NextRequest){
 try{
 const {a,canView}=await compensationAccess();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company selection required'},{status:403});
 if(!canView)return NextResponse.json({error:'Compensation permission required'},{status:403});
 const employees=await db.employee.findMany({where:scopedEmployee(a),select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,position:true,branch:{select:{name:true}}},orderBy:{firstName:'asc'},take:1000});
 const packages=await db.employeeCompensation.findMany({where:{companyId:a.companyId,employee:scopedEmployee(a)},orderBy:[{effectiveDate:'desc'},{createdAt:'desc'}],take:1000});
 return NextResponse.json({employees,packages:packages.map(p=>({...p,basicSalary:Number(p.basicSalary)}))},{headers:{'Cache-Control':'private, no-store'}});
 }catch(err){console.error('[compensation GET]',err);return NextResponse.json({error:'Unable to load compensation data. Confirm the EmployeeCompensation table exists and Prisma Client was regenerated; see Railway logs for details.'},{status:500})}
}
export async function POST(req:NextRequest){
 let a:Awaited<ReturnType<typeof compensationAccess>>['a'];let canEdit:boolean;try{({a,canEdit}=await compensationAccess())}catch(err){console.error('[compensation POST auth]',err);return NextResponse.json({error:'Unable to initialize compensation access'},{status:500})}
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company selection required'},{status:403});
 if(!canEdit)return NextResponse.json({error:'HR edit permission required'},{status:403});
 try{
  const d=await req.json();
  if(typeof d.employeeId!=='string')throw Error('Select an employee');
  const employee=await db.employee.findFirst({where:{AND:[scopedEmployee(a),{id:d.employeeId}]}});
  if(!employee)return NextResponse.json({error:'Employee not found in your scope'},{status:404});
  const basic=Number(d.basicSalary);
  if(!Number.isFinite(basic)||basic<0||basic>1e9)throw Error('Invalid basic salary');
  const date=new Date(`${d.effectiveDate}T00:00:00.000Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveDate)||Number.isNaN(date.getTime()))throw Error('Invalid effective date');
  const row=await db.employeeCompensation.create({data:{companyId:a.companyId,employeeId:employee.id,effectiveDate:date,basicSalary:basic.toFixed(2),allowances:moneyParts(d.allowances||[]),deductions:moneyParts(d.deductions||[]),benefits:moneyParts(d.benefits||[]),reason:String(d.reason||'').slice(0,1000),createdById:a.user.id}});
  return NextResponse.json({id:row.id},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400})}
}
