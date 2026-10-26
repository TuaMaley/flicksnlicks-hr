/* Read-only diagnostic for Flicks & Licks Phase 16.1. Never inserts/updates/deletes. */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const TAG='FNL-DEMO-16-1';
(async()=>{
 const u=new URL(process.env.DATABASE_URL||'');
 const database=decodeURIComponent(u.pathname.slice(1));
 console.log('Database host:',u.hostname,'Database name:',database);
 const [employees,synthetic,branches,comp,att,leave,appraisals,batches,payments]=await Promise.all([
 db.employee.count(),db.employee.count({where:{employeeNo:{startsWith:TAG}}}),db.branch.count(),
 db.employeeCompensation.count(),db.payrollAttendance.count(),db.leaveRequest.count(),db.appraisal.count(),
 db.payrollCalculationBatch.count(),db.payrollPayment.count()
 ]);
 console.log(JSON.stringify({employees,syntheticEmployees:synthetic,branches,compensation:comp,attendance:att,leave,appraisals,payrollBatches:batches,paymentRecords:payments},null,2));
 console.log('READ-ONLY COMPLETE: No data changed.');
})().catch(e=>{console.error('Preflight failed:',e.message);process.exitCode=1}).finally(()=>db.$disconnect());
