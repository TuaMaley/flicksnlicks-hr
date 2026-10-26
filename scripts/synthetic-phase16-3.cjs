/* Phase 16.3: synthetic leave, appraisals and PIPs. No approvals, payroll, payments or employee changes. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PREFIX = 'FNL-SYN-16-1-';
const MARKER = '[SYNTHETIC PHASE16.3]';
const action = process.argv[2] || 'preview';
const date = s => new Date(`${s}T12:00:00.000Z`);
async function main() {
  const employees = await prisma.employee.findMany({where:{employeeNo:{startsWith:PREFIX}},select:{id:true,employeeNo:true,status:true},orderBy:{employeeNo:'asc'}});
  const ids = employees.map(e=>e.id);
  const [leave,appraisals,pips,existingMarkedLeave,existingMarkedAppraisals,existingMarkedPips] = await Promise.all([
    prisma.leaveRequest.count({where:{employeeId:{in:ids}}}),
    prisma.appraisal.count({where:{employeeId:{in:ids}}}),
    prisma.performanceImprovementPlan.count({where:{employeeId:{in:ids}}}),
    prisma.leaveRequest.count({where:{employeeId:{in:ids},reason:{startsWith:MARKER}}}),
    prisma.appraisal.count({where:{employeeId:{in:ids},title:{startsWith:MARKER}}}),
    prisma.performanceImprovementPlan.count({where:{employeeId:{in:ids},title:{startsWith:MARKER}}})
  ]);
  const state = {action,syntheticEmployees:employees.length,leaveRequests:leave,appraisals,pips,phase16_3:{leave:existingMarkedLeave,appraisals:existingMarkedAppraisals,pips:existingMarkedPips}};
  console.log(JSON.stringify(state,null,2));
  if (action === 'preview') return;
  if (action !== 'seed') throw Error('Usage: node scripts\\synthetic-phase16-3.cjs preview | seed');
  if (process.env.CONFIRM_SYNTHETIC_PHASE16_3 !== 'YES') throw Error('Refused: set CONFIRM_SYNTHETIC_PHASE16_3=YES');
  if (employees.length !== 40 || employees.some(e=>e.status !== 'SUSPENDED')) throw Error('Refused: expected exactly 40 suspended synthetic employees.');
  if (leave || appraisals || pips) throw Error('Refused: existing leave/appraisal/PIP records for synthetic employees. No duplicates or overwrites.');
  const actor = await prisma.user.findFirst({where:{active:true},select:{id:true},orderBy:{id:'asc'}});
  if (!actor) throw Error('Refused: no active user for audit/createdById.');
  const leaveData = Array.from({length:20},(_,i)=>({employeeId:employees[i].id,type:i%3===0?'SICK':'ANNUAL',startDate:date(`2026-${String(5+i%5).padStart(2,'0')}-${String(5+(i%15)).padStart(2,'0')}`),endDate:date(`2026-${String(5+i%5).padStart(2,'0')}-${String(5+(i%15)).padStart(2,'0')}`),days:1,status:'PENDING',reason:`${MARKER} Sample leave request; not a real employee request.`}));
  const appraisalData = Array.from({length:30},(_,i)=>({employeeId:employees[i].id,title:`${MARKER} Sample quarterly appraisal`,period:i%2===0?'2026-Q2':'2026-Q3',status:'DRAFT',score:null}));
  const pipData = Array.from({length:5},(_,i)=>({employeeId:employees[30+i].id,title:`${MARKER} Sample performance improvement plan`,reason:`${MARKER} Demonstration record only; no actual performance determination.`,goals:[{goal:'Improve sample service KPI',target:'Demonstration only'}],status:'DRAFT',startDate:date('2026-09-01'),dueDate:date('2026-11-30'),createdById:actor.id}));
  const result = await prisma.$transaction(async tx=>{
    const [a,b,c] = await Promise.all([
      tx.leaveRequest.count({where:{employeeId:{in:ids}}}),
      tx.appraisal.count({where:{employeeId:{in:ids}}}),
      tx.performanceImprovementPlan.count({where:{employeeId:{in:ids}}})
    ]);
    if (a || b || c) throw Error('Records appeared since preview; refusing duplicate insertion.');
    const l=await tx.leaveRequest.createMany({data:leaveData});
    const ap=await tx.appraisal.createMany({data:appraisalData});
    const p=await tx.performanceImprovementPlan.createMany({data:pipData});
    await tx.auditLog.create({data:{actorId:actor.id,action:'SYNTHETIC_PHASE16_3_SEED',entity:'SyntheticDataset',entityId:'FNL-SYN-16-1',detail:{leave:l.count,appraisals:ap.count,pips:p.count,marker:MARKER,note:'Pending/draft only. No payroll or payments.'}}});
    return {leave:l.count,appraisals:ap.count,pips:p.count};
  });
  console.log('CREATED:',JSON.stringify(result));
}
main().catch(e=>{console.error('ERROR:',e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
