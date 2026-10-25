import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';

const safe=(s:string)=>s.replace(/[\\r\\n]+/g,' ').slice(0,250);
const csvCell=(value:unknown)=>{
 let s=String(value??'');
 // Prevent spreadsheet formula injection when opened in Excel.
 if(/^[\\s]*[=+@\\-]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
export async function GET(req:NextRequest){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const isHR=a.user.roles.some(r=>r.role.active&&['HR Manager','Administrator'].includes(r.role.name));
 if(!a.can('appraisals.view')||(!isHR&&!a.can('appraisals.reports.view')))
  return NextResponse.json({error:'Reporting access is restricted to HR or an explicitly authorized role'},{status:403});
 const q=req.nextUrl.searchParams;
 const period=safe(q.get('period')||'');
 const status=safe(q.get('status')||'');
 const employeeId=safe(q.get('employeeId')||'');
 const branchId=safe(q.get('branchId')||'');
 const format=q.get('format')||'json';
 if(period&&!/^\\d{4}-(Q[1-4]|H[12]|ANNUAL)$/.test(period))return NextResponse.json({error:'Invalid period'},{status:400});
 const allowed=['DRAFT','SUBMITTED','APPROVED','REJECTED','PENDING_HR_APPROVAL','FINALIZED'];
 if(status&&!allowed.includes(status))return NextResponse.json({error:'Invalid status'},{status:400});
 if(!['json','csv'].includes(format))return NextResponse.json({error:'Invalid format'},{status:400});
 const where:any={employee:employeeWhere(a)};
 if(period)where.period=period;
 if(status)where.status=status;
 if(employeeId)where.employeeId=employeeId;
 if(branchId)where.employee={AND:[employeeWhere(a),{branchId}]};
 const records=await db.appraisalReview.findMany({
  where,include:{
   employee:{select:{id:true,employeeNo:true,firstName:true,lastName:true,department:true,position:true,branch:{select:{name:true}}}},
   template:{select:{name:true,criteria:true}}
  },orderBy:{createdAt:'desc'},take:2000
 });
 const reports=records.map(r=>({
  id:r.id,employeeId:r.employeeId,employeeNo:r.employee.employeeNo,
  employee:`${r.employee.firstName} ${r.employee.lastName}`,
  department:r.employee.department,branch:r.employee.branch?.name||'',
  position:r.employee.position,template:r.template.name,period:r.period,status:r.status,
  score:r.score,selfScores:r.selfScores,managerScores:r.managerScores,
  selfComment:r.selfComment,managerComment:r.managerComment,
  criteria:r.template.criteria,createdAt:r.createdAt.toISOString(),
  approvedAt:r.approvedAt?.toISOString()||null
 }));
 const scored=reports.filter(r=>r.score!==null);
 const summary={total:reports.length,completed:reports.filter(r=>['APPROVED','FINALIZED'].includes(r.status)).length,
  pending:reports.filter(r=>['SUBMITTED','PENDING_HR_APPROVAL'].includes(r.status)).length,
  rejected:reports.filter(r=>r.status==='REJECTED').length,
  averageScore:scored.length?Number((scored.reduce((s,r)=>s+(r.score||0),0)/scored.length).toFixed(2)):null,
  truncated:records.length===2000};
 if(format==='csv'){
  const headings=['Employee Number','Employee','Department','Branch','Position','Template','Period','Status','Score / 5','Self Comment','Manager Comment','Self KPI Scores','Manager KPI Scores','Created At','Approved At'];
  const lines=[headings.map(csvCell).join(',')];
  for(const r of reports)lines.push([r.employeeNo,r.employee,r.department,r.branch,r.position,r.template,r.period,r.status,r.score??'',r.selfComment??'',r.managerComment??'',JSON.stringify(r.selfScores??{}),JSON.stringify(r.managerScores??{}),r.createdAt,r.approvedAt??''].map(csvCell).join(','));
  const filename=`appraisal-report-${new Date().toISOString().slice(0,10)}.csv`;
  return new NextResponse('\uFEFF'+lines.join('\\r\\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json({reports,summary},{headers:{'Cache-Control':'private, no-store'}});
}
