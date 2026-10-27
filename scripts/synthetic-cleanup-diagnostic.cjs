/* Phase 16 cleanup: preview by default; strictly scoped transactional removal. */
const {PrismaClient}=require('@prisma/client');
const crypto=require('crypto');
const prisma=new PrismaClient();
const PREFIX='FNL-SYN-16-1-';
const MARKER='[SYNTHETIC PHASE16.3]';
const EXPECT={employees:40,compensation:40,attendance:240,leave:20,appraisals:30,pips:5};
const mode=process.argv[2]||'preview';
const models={
 compensation:'employeeCompensation',attendance:'payrollAttendance',leave:'leaveRequest',
 appraisals:'appraisal',pips:'performanceImprovementPlan'
};
const extra=['user','leaveEntitlement','appraisalReview','appraisalCycleAssignment','onboardingCase','disciplinaryCase','recognition','ghanaPayrollAdjustment'];
function stop(msg){throw new Error('REFUSED: '+msg)}
async function inspect(tx){
 const employees=await tx.employee.findMany({where:{employeeNo:{startsWith:PREFIX}},select:{id:true,employeeNo:true,status:true,email:true,notes:true},orderBy:{employeeNo:'asc'}});
 const ids=employees.map(e=>e.id);
 const where={employeeId:{in:ids}};
 const counts={employees:ids.length};
 for(const [k,m] of Object.entries(models))counts[k]=await tx[m].count({where});
 const unexpected={};
 for(const m of extra)unexpected[m]=await tx[m].count({where});
 const payments=await tx.payrollPayment.count({where:{OR:[{employeeId:{in:ids}},{employeeNo:{startsWith:PREFIX}}]}});
 unexpected.payrollPayment=payments;
 // Batch line items may contain embedded employee IDs or employee numbers, even without a foreign key.
 const batchMatches=await tx.$queryRaw`
 SELECT count(*)::int AS count FROM "PayrollCalculationBatch" b
 WHERE EXISTS (
   SELECT 1 FROM "Employee" e
   WHERE e."employeeNo" LIKE 'FNL-SYN-16-1-%'
   AND (b."lineItems"::text LIKE '%' || e.id || '%'
     OR b."lineItems"::text LIKE '%' || e."employeeNo" || '%')
 )`;
 unexpected.payrollCalculationBatchReferences=Number(batchMatches[0]?.count||0);
 const checks={
   correctPrefixAndIdentity:employees.every(e=>/^FNL-SYN-16-1-\d{3}$/.test(e.employeeNo)&&e.email?.endsWith('@example.invalid')&&e.notes?.includes('SYNTHETIC TEST RECORD')),
   suspended:employees.every(e=>e.status==='SUSPENDED'),
   expectedCounts:Object.keys(EXPECT).every(k=>counts[k]===EXPECT[k]),
   noUnexpectedDependencies:Object.values(unexpected).every(v=>v===0),
 };
 if(ids.length){
   const [markedLeave,markedAppraisals,markedPips,draftComp,draftAttendance]=await Promise.all([
     tx.leaveRequest.count({where:{...where,reason:{startsWith:MARKER}}}),
     tx.appraisal.count({where:{...where,title:{startsWith:MARKER}}}),
     tx.performanceImprovementPlan.count({where:{...where,title:{startsWith:MARKER}}}),
     tx.employeeCompensation.count({where:{...where,status:'DRAFT',reason:{contains:'SYNTHETIC'}}}),
     tx.payrollAttendance.count({where:{...where,status:'DRAFT',notes:{contains:'SYNTHETIC'}}}),
   ]);
   checks.allRecordsMarked=markedLeave===counts.leave&&markedAppraisals===counts.appraisals&&markedPips===counts.pips&&draftComp===counts.compensation&&draftAttendance===counts.attendance;
   const markerCounts={leave:{matched:markedLeave,total:counts.leave},appraisals:{matched:markedAppraisals,total:counts.appraisals},pips:{matched:markedPips,total:counts.pips},compensation:{matched:draftComp,total:counts.compensation},attendance:{matched:draftAttendance,total:counts.attendance}};
   const missing={};
   for(const [k,v] of Object.entries(markerCounts))if(v.matched!==v.total)missing[k]=v.total-v.matched;
   checks.markerCounts=markerCounts;
   checks.markerMissing=missing;
 }else checks.allRecordsMarked=false;
 const token=crypto.createHash('sha256').update(JSON.stringify({ids,counts,unexpected})).digest('hex').slice(0,12).toUpperCase();
 return {counts,unexpected,checks,ready:['correctPrefixAndIdentity','suspended','expectedCounts','noUnexpectedDependencies','allRecordsMarked'].every(k=>checks[k]===true),token,ids};
}
async function main(){
 if(!['preview','delete'].includes(mode))stop('Usage: node scripts\\synthetic-cleanup-production.cjs preview | delete');
 if(mode==='delete')stop('Diagnostic version is read-only; do not use for deletion.');
 if(mode==='preview'){
   const state=await inspect(prisma);
   console.log(JSON.stringify({action:'preview',counts:state.counts,unexpected:state.unexpected,checks:state.checks,readyToDelete:state.ready,confirmationToken:state.ready?state.token:null},null,2));
   console.log('READ-ONLY: No data changed.');return;
 }
 if(process.env.CONFIRM_SYNTHETIC_DELETE!=='DELETE_40_PERMANENTLY')stop('Set CONFIRM_SYNTHETIC_DELETE=DELETE_40_PERMANENTLY');
 const result=await prisma.$transaction(async tx=>{
   const s=await inspect(tx);
   if(!s.ready)stop('Preview checks did not pass. No records deleted.');
   if(process.env.SYNTHETIC_DELETE_TOKEN!==s.token)stop('Confirmation token mismatch; rerun preview.');
   const where={employeeId:{in:s.ids}};
   const removed={};
   // Delete only dependent rows for the exact generated employee IDs.
   for(const [k,m] of Object.entries(models)){
     removed[k]=(await tx[m].deleteMany({where})).count;
     if(removed[k]!==EXPECT[k])stop(k+' deletion count mismatch. Transaction rolled back.');
   }
   removed.employees=(await tx.employee.deleteMany({where:{id:{in:s.ids},employeeNo:{startsWith:PREFIX}}})).count;
   if(removed.employees!==EXPECT.employees)stop('Employee deletion count mismatch. Transaction rolled back.');
   // Keep historical seed audit logs; record the cleanup as an audit event.
   await tx.auditLog.create({data:{action:'SYNTHETIC_PHASE16_CLEANUP',entity:'SyntheticDataset',entityId:'FNL-SYN-16-1',detail:{removed,marker:PREFIX,retained:'real employee, payroll, payment, branch and audit records'}}});
   return removed;
 },{maxWait:10000,timeout:60000,isolationLevel:'Serializable'});
 console.log('SUCCESS — deleted synthetic operational records:',JSON.stringify(result,null,2));
 console.log('Real employees, existing payroll/payment records and historical audit logs were not targeted.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
