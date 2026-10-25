# Flicks & Licks HRMS — Three-Level Appraisal Approval (Option B)

Files to replace:
- app/appraisals/page.tsx
- app/api/appraisals/reviews/[id]/route.ts

Schema change: edit the existing AppraisalStatus enum using prisma/PHASE6-SCHEMA-CHANGE.txt. Do NOT replace your complete schema.

Workflow: DRAFT -> SUBMITTED -> MANAGER_REVIEWED -> PENDING_HR_APPROVAL -> FINALIZED.
- Employee self-submits.
- Authorized branch manager saves ratings, then approves and forwards to HR.
- HR Manager/Administrator finalizes; cannot be the same account that approved as manager.
- Manager rejection returns to REJECTED with a required reason. HR rejection returns to MANAGER_REVIEWED with a required reason. Reasons and transitions are recorded in AuditLog.detail.
- Branch scoping is enforced using existing employeeWhere access scope.
- Old APPROVED values remain in the enum for compatibility; previously approved appraisals are not automatically converted.

Install: back up project/database; edit schema; run `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit`, `npm run build`; then apply `npx prisma db push` against the intended database after reviewing warnings. Commit and deploy.

NOTE: This patch does not automatically migrate previously APPROVED records or introduce new approver-specific DB columns. AuditLog records HR finalization and rejection. Test with employee, manager and separate HR accounts.
