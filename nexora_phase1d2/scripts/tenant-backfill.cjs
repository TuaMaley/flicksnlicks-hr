// Nexora Phase 1D.2: conservative FNL001 operational data backfill.
// AuditLog deliberately excluded: platform-vs-company attribution requires review.
// Dry-run by default. Never deletes or overwrites a non-null companyId.
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const models = [
  'Branch','Employee','Role','UserAccessScope','LeaveRequest','LeavePolicy','LeaveEntitlement',
  'Appraisal','PayrollRun','Training','TrainingEnrollment','TrainingAttendanceSession',
  'TrainingAttendance','JobOpening','OnboardingCase','OnboardingTask','DisciplinaryCase',
  'Recognition','AppraisalTemplate','AppraisalReview','AppraisalCycle','AppraisalCycleAssignment',
  'PerformanceImprovementPlan','PerformanceImprovementCheckIn','EmployeeCompensation',
  'PayrollAttendance','PayrollCalculationBatch','PayrollApprovalEvent','GhanaPayrollPolicy',
  'GhanaPayrollAdjustment','PayrollPayment','PayrollPaymentEvent','TrainingEvaluationQuestion',
  'TrainingEvaluationResponse','TrainingEvaluationAnswer','EmployeeExitCase','EmployeeExitTask',
  'DisciplinaryHearing','DisciplinaryAppeal','DisciplinaryApprovalRequest','DisciplinaryLetter',
  'DisciplinaryNotice','RecruitmentRequisition','RecruitmentVacancy','RecruitmentCandidate',
  'RecruitmentApplication','RecruitmentInterview','RecruitmentAssessment','RecruitmentOffer',
  'EmployeeHRRequest','AccessReview'
];
const apply = process.argv.includes('--apply');
const confirmed = process.env.NEXORA_BACKFILL_CONFIRM === 'FNL001';
const delegate = (client, model) => client[model[0].toLowerCase() + model.slice(1)];
async function countRows(client, companyId) {
  const rows=[];
  for (const model of models) {
    const d=delegate(client,model);
    const [total,unassigned,alreadyTarget,other] = await Promise.all([
      d.count(),d.count({where:{companyId:null}}),
      d.count({where:{companyId}}),
      d.count({where:{companyId:{not:null,notIn:[companyId]}}})
    ]);
    rows.push({model,total,unassigned,alreadyTarget,other});
  }
  return rows;
}
async function main() {
  if (process.argv.some(x => x.startsWith('--') && x !== '--apply'))
    throw new Error('Unsupported option; only --apply is accepted.');
  const company=await db.company.findUnique({where:{code:'FNL001'}});
  if (!company || !company.active) throw new Error('Active FNL001 company not found; no changes made.');
  const others=await db.company.findMany({where:{id:{not:company.id}},select:{code:true}});
  console.log('Target:',company.name,company.code,company.id);
  console.log('Other registered companies:',others.map(x=>x.code).join(', ')||'none');
  if (others.length) throw new Error('Other companies exist: blanket backfill disabled. No changes made.');
  const audit = await db.auditLog.count({where:{companyId:null}});
  console.log('AuditLog unassigned (EXCLUDED; needs attribution review):',audit);
  console.log('Role and GhanaPayrollPolicy are treated as FNL001-specific existing records.');
  const rows=await countRows(db,company.id);
  console.table(rows);
  if (rows.some(r=>r.other>0)) throw new Error('Non-target company ownership detected; no changes made.');
  if (!apply) {console.log('DRY RUN ONLY. No changes made.');return;}
  if (!confirmed) throw new Error('Set NEXORA_BACKFILL_CONFIRM=FNL001 and pass --apply. No changes made.');
  const updated=await db.$transaction(async tx=>{
    const before=await countRows(tx,company.id);
    if (before.some(r=>r.other>0)) throw new Error('Ownership changed since dry run.');
    const out=[];
    for (const row of before) {
      const changed=await delegate(tx,row.model).updateMany({where:{companyId:null},data:{companyId:company.id}});
      if (changed.count!==row.unassigned) throw new Error('Unexpected count for '+row.model+'; rolling back.');
      out.push({model:row.model,updated:changed.count});
    }
    const after=await countRows(tx,company.id);
    for (let i=0;i<before.length;i++) {
      const a=after[i],b=before[i];
      if(a.total!==b.total||a.unassigned!==0||a.other!==0||a.alreadyTarget!==b.alreadyTarget+b.unassigned)
        throw new Error('Reconciliation failed for '+a.model+'; rolling back.');
    }
    return out;
  },{timeout:120000,maxWait:30000,isolationLevel:'Serializable'});
  console.table(updated);
  console.log('COMMITTED: operational models reconciled inside transaction.');
  console.log('AuditLog remains excluded; review separately before enforcing non-null companyId.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
