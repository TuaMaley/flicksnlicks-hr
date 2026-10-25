# Phase 15E — Process Payroll (draft calculation only)

Based on uploaded project ZIP `flicks-hrms-phase4-initial-complete-update2.zip`.

Copy files into project, preserving paths:
- `app/payroll/process/page.tsx` (new)
- `app/payroll/process/process.css` (new)
- `app/api/payroll/process/route.ts` (new)
- `app/components/PayrollSectionNav.tsx` (replace; enables Process Payroll)
- `prisma/schema.prisma` (MERGE ONLY the `PayrollCalculationBatch` model at bottom if your live schema has evolved; do not overwrite newer models)

Run from project root:
```
npx prisma validate
npx prisma db push
npx prisma generate
npx tsc --noEmit
npm run build
```
Verify correct PostgreSQL target and take backup before db push. Do not accept destructive resets. Commit updated Prisma schema to GitHub for Railway builds.

## Important limitations
- HR Manager / Administrator only. Company-wide financial figures are not exposed to branch users.
- Only approved compensation effective by month-end is included. Employees lacking approved compensation are excluded.
- Approved attendance days and overtime hours are displayed but do NOT affect salary calculations yet.
- `netBeforeStatutory` is NOT take-home pay. PAYE, SSNIT, pension, advances, overtime pay, proration and absences not calculated. Do not disburse salaries based on these previews.
- Saves immutable DRAFT calculation snapshots in `PayrollCalculationBatch` and does not modify legacy `PayrollRun` or trigger approvals/payments.
- Repeated saves intentionally create separate historical snapshots; no finalization or approval logic yet.
- No production build was run in this environment.
