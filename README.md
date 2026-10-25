# Phase 15F — Payroll Approvals (preliminary calculation workflow)

Built against Phase 15E schema, with `PayrollCalculationBatch` and `PayrollApprovalEvent`.

## Files
- `prisma/schema.prisma`: MERGE the new `approvals PayrollApprovalEvent[]` field into `PayrollCalculationBatch`, and add the `PayrollApprovalEvent` model. **Do not overwrite a newer live schema**.
- `app/components/PayrollSectionNav.tsx`: REPLACE; enables Approvals.
- `app/payroll/approvals/page.tsx` and `approvals.css`: NEW.
- `app/api/payroll/approvals/route.ts` and `[id]/route.ts`: NEW.

## Deployment
From project root, after merging schema and verifying DATABASE_URL targets the intended database:
```
npx prisma validate
npx prisma db push
npx prisma generate
npx tsc --noEmit
npm run build
```
Take a backup and stop if Prisma warns of destructive changes. Commit all files to GitHub and verify Railway deploys the matching schema. Do not expose DATABASE_URL.

## Workflow
- HR Manager / Administrator submits DRAFT -> HR_REVIEW.
- Different HR Manager / Administrator approves HR_REVIEW -> FINANCE_REVIEW.
- Finance Officer / Finance Manager / Administrator, different from the batch creator and HR reviewer, approves FINANCE_REVIEW -> APPROVED.
- Active reviewer may reject with 10–1000 character reason; REJECTED is terminal. Prepare a new calculation draft for corrections.
- Workflow changes use a conditional update inside a DB transaction; append-only events capture actor, reason and timestamps.
- The `APPROVED` status **only approves preliminary calculation snapshots for workflow**. The calculations omit statutory taxes, pension, overtime pay and final payroll adjustments. They are NOT approved for disbursement.

## Notes
- Existing Phase 15E `PayrollCalculationBatch` is required; run Phase 15E schema synchronization first.
- Roles must be named exactly `Finance Officer` or `Finance Manager` for Finance access (or `Administrator` with separation of duties).
- Batch scope is company-wide, consistent with Phase 15E; do not grant Finance roles to branch-limited users until branch-level batch scoping is implemented.
- Reviewer's ID rather than name is shown in the history; future work can add a directory lookup.
- The source package has not been compiled against the user's current deployed repository.
