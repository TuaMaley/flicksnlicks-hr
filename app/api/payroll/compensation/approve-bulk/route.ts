import {NextRequest,NextResponse} from 'next/server';
import {compensationAccess,db} from '../helpers';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{
  const {a,canApprove}=await compensationAccess();
  if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!a.companyId||!canApprove)return NextResponse.json({error:'HR Manager compensation approval permission required'},{status:403});
  const body=await req.json();const ids:unknown=body.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(x=>typeof x!=='string'||!x)||new Set(ids).size!==ids.length)return NextResponse.json({error:'Select 1–100 distinct compensation packages'},{status:400});
  const result=await db.$transaction(async tx=>{
   const rows=await tx.employeeCompensation.findMany({where:{id:{in:ids},companyId:a.companyId!,employee:{companyId:a.companyId!}}});
   if(rows.length!==ids.length)return {error:'One or more packages are not in the selected company',status:403};
   for(const row of rows){if(row.status!=='PENDING_APPROVAL')return {error:'All selected packages must be pending approval',status:409};if(row.createdById===a.user!.id)return {error:'You cannot approve a compensation package you prepared',status:403}}
   const changed=await tx.employeeCompensation.updateMany({where:{id:{in:ids},companyId:a.companyId!,status:'PENDING_APPROVAL',createdById:{not:a.user!.id}},data:{status:'APPROVED',reviewedById:a.user!.id,reviewedAt:new Date(),reviewNote:'Bulk approved by HR Manager'}});
   if(changed.count!==ids.length)throw new Error('Compensation changed during review; no approvals committed');
   return {approved:changed.count};
  },{timeout:30000});
  if('error'in result)return NextResponse.json({error:result.error},{status:result.status});
  return NextResponse.json(result);
 }catch(e){console.error('[bulk compensation approval]',e);return NextResponse.json({error:'Bulk approval failed; no packages were approved'},{status:500})}
}
