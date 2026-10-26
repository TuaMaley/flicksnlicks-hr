/* Phase 16.2: production synthetic compensation (DRAFT) and attendance (DRAFT) only. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PREFIX = 'FNL-SYN-16-1-';
const action = process.argv[2] || 'preview';
const money = (n) => Math.round(n * 100) / 100;
async function main() {
  const employees = await prisma.employee.findMany({where:{employeeNo:{startsWith:PREFIX}},select:{id:true,employeeNo:true,department:true,position:true,status:true},orderBy:{employeeNo:'asc'}});
  const ids = employees.map(e=>e.id);
  const [packages, attendance, total] = await Promise.all([
    prisma.employeeCompensation.count({where:{employeeId:{in:ids}}}),
    prisma.payrollAttendance.count({where:{employeeId:{in:ids}}}),
    prisma.employee.count()
  ]);
  console.log(JSON.stringify({action,totalEmployees:total,syntheticEmployees:employees.length,existingSyntheticCompensation:packages,existingSyntheticAttendance:attendance},null,2));
  if(action==='preview')return;
  if(action!=='seed')throw Error('Usage: node scripts\\synthetic-phase16-2.cjs preview | seed');
  if(process.env.CONFIRM_SYNTHETIC_HR_DRAFTS!=='YES')throw Error('Refused: set CONFIRM_SYNTHETIC_HR_DRAFTS=YES');
  if(employees.length!==40 || employees.some(e=>e.status!=='SUSPENDED'))throw Error('Refused: expected exactly 40 SUSPENDED synthetic employees.');
  if(packages || attendance)throw Error('Refused: synthetic compensation or attendance already exists; no duplicates or modifications allowed.');
  const actor=await prisma.user.findFirst({where:{active:true},select:{id:true},orderBy:{id:'asc'}});
  if(!actor)throw Error('Refused: no active user available for required createdById/submittedById.');
  const comp=[]; const attend=[];
  const dates=['2026-09-07','2026-09-09','2026-09-11','2026-09-14','2026-09-16','2026-09-18'];
  for(let i=0;i<employees.length;i++){
    const e=employees[i];
    const base= e.department==='Finance'||e.department==='IT'||e.department==='HR' ? 3100 : e.position.toLowerCase().includes('supervisor') ? 2700 : 1550;
    const salary=money(base + (i%7)*115);
    comp.push({employeeId:e.id,effectiveDate:new Date('2026-09-01T00:00:00.000Z'),basicSalary:salary,allowances:{transport:money(salary*.08),meal:money(salary*.05)},deductions:{},benefits:{},currency:'GHS',status:'DRAFT',reason:'SYNTHETIC DATA ONLY — NOT APPROVED OR PAYABLE',createdById:actor.id});
    for(let j=0;j<dates.length;j++){
      attend.push({employeeId:e.id,workDate:new Date(dates[j]+'T00:00:00.000Z'),clockIn:'09:00',clockOut:'17:00',breakMinutes:60,regularMinutes:420,overtimeMinutes:0,notes:'SYNTHETIC DRAFT ATTENDANCE — NOT VERIFIED',status:'DRAFT',submittedById:actor.id});
    }
  }
  const result=await prisma.$transaction(async tx=>{
    const checkComp=await tx.employeeCompensation.count({where:{employeeId:{in:ids}}});
    const checkAttend=await tx.payrollAttendance.count({where:{employeeId:{in:ids}}});
    if(checkComp||checkAttend)throw Error('Concurrent related records found; transaction aborted.');
    const a=await tx.employeeCompensation.createMany({data:comp});
    const b=await tx.payrollAttendance.createMany({data:attend});
    await tx.auditLog.create({data:{actorId:actor.id,action:'SYNTHETIC_PHASE16_2_SEED',entity:'SyntheticDataset',entityId:'FNL-SYN-16-1',detail:{compensation:a.count,attendance:b.count,note:'DRAFT only; not real payroll'}}});
    return {compensation:a.count,attendance:b.count};
  });
  console.log('CREATED:',JSON.stringify(result),'All records DRAFT; no payroll or payments created.');
}
main().catch(e=>{console.error('ERROR:',e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
