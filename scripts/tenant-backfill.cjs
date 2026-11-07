// Phase 1D.1: dry-run by default; APPLY requires explicit acknowledgement.
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const models=["Branch", "Employee", "Role", "UserAccessScope", "LeaveRequest", "LeavePolicy", "LeaveEntitlement", "Appraisal", "AuditLog", "PayrollRun", "Training", "TrainingEnrollment", "TrainingAttendanceSession", "TrainingAttendance", "JobOpening", "OnboardingCase", "OnboardingTask", "DisciplinaryCase", "Recognition", "AppraisalTemplate", "AppraisalReview", "AppraisalCycle", "AppraisalCycleAssignment", "PerformanceImprovementPlan", "PerformanceImprovementCheckIn", "EmployeeCompensation", "PayrollAttendance", "PayrollCalculationBatch", "PayrollApprovalEvent", "GhanaPayrollPolicy", "GhanaPayrollAdjustment", "PayrollPayment", "PayrollPaymentEvent", "TrainingEvaluationQuestion", "TrainingEvaluationResponse", "TrainingEvaluationAnswer", "EmployeeExitCase", "EmployeeExitTask", "DisciplinaryHearing", "DisciplinaryAppeal", "DisciplinaryApprovalRequest", "DisciplinaryLetter", "DisciplinaryNotice", "RecruitmentRequisition", "RecruitmentVacancy", "RecruitmentCandidate", "RecruitmentApplication", "RecruitmentInterview", "RecruitmentAssessment", "RecruitmentOffer", "EmployeeHRRequest", "AccessReview"];
const apply=process.argv.includes('--apply');
const confirmed=process.env.NEXORA_BACKFILL_CONFIRM==='FNL001';
async function main(){
 const company=await db.company.findUnique({where:{code:'FNL001'}});
 if(!company)throw Error('Company code FNL001 not found; no changes made');
 if(!company.active)throw Error('FNL001 is inactive; no changes made');
 const others=await db.company.findMany({where:{id:{not:company.id}},select:{code:true}});
 console.log('Target:',company.name,company.code,company.id);
 console.log('Other registered companies:',others.map(x=>x.code).join(', ')||'none');
 console.log('WARNING: this assumes ALL existing unassigned operational records belong to FNL001.');
 if(apply&&!confirmed)throw Error('To apply, set NEXORA_BACKFILL_CONFIRM=FNL001 and pass --apply');
 const rows=[];
 for(const model of models){
  const delegate=db[model[0].toLowerCase()+model.slice(1)];
  const [total,unassigned,other]=await Promise.all([
   delegate.count(),delegate.count({where:{companyId:null}}),delegate.count({where:{companyId:{not:null,notIn:[company.id]}}})
  ]);
  rows.push({model,total,unassigned,alreadyTarget:total-unassigned-other,other});
 }
 console.table(rows);
 if(rows.some(r=>r.other>0))throw Error('Records assigned to another company already exist. Refusing blanket backfill.');
 if(!apply){console.log('DRY RUN ONLY. No changes made.');return}
 // Atomic backfill, no deletions, no reassignment of non-null companyId.
 const result=await db.$transaction(async tx=>{
  const updated=[];
  for(const row of rows){
   const delegate=tx[row.model[0].toLowerCase()+row.model.slice(1)];
   const changed=await delegate.updateMany({where:{companyId:null},data:{companyId:company.id}});
   updated.push({model:row.model,updated:changed.count});
  }
  return updated;
 },{timeout:120000,maxWait:30000});
 console.table(result);
 for(const row of rows){
  const remaining=await db[row.model[0].toLowerCase()+row.model.slice(1)].count({where:{companyId:null}});
  if(remaining!==0)throw Error('Verification failed: '+row.model+' has '+remaining+' unassigned records');
 }
 console.log('BACKFILL VERIFIED: no unassigned rows in the selected models.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
