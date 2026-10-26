# Phase 16.1 — Synthetic workforce starter (NOT production-ready)

This patch is **not a complete production deployment**. It contains a synthetic data generator and a guard in the Payroll Process API excluding synthetic employee IDs. It does **not** implement the promised Administrator UI, a complete isolation review across all exports, an ownership registry, or a tested reversible deletion across every relation. Therefore **DO NOT RUN `seed` against production yet**, even though the script exposes explicit confirmation variables. Those variables are defense-in-depth, not proof of safety.

## Included
- `scripts/demo-data.cjs`: 30–50 synthetic employees, salary drafts, attendance drafts, leave, appraisals, PIPs, training, openings, six months of DRAFT payroll snapshots. Default 40. No approved payroll, real payment records, or payslips.
- `app/api/payroll/process/route.ts`: excludes employee numbers starting with `FNL-SYNTH-` from payroll calculation. Keep this guard in future updates.

## Before production use
1. Test seeding, dashboard and deletion on a restored copy of production. Inspect dependencies and record counts.
2. Add isolation to **all** compensation approval, attendance approval, payroll approval, payments preparation, Excel import/export, payslip, regulatory exports and report paths. Never let synthetic records create payable obligations.
3. Add durable seed-batch ownership tracking, administrative UI, audit logs, and transactional dependency-aware deletion with preview.
4. Obtain approval from the database administrator and confirm the production backup is restorable.

## Safe test instructions (isolated test DB only)
In Windows CMD: `set CONFIRM_DEMO_DATABASE=YES` then `node scripts\demo-data.cjs seed 40`; `node scripts\demo-data.cjs preview`; `set CONFIRM_DELETE_DEMO=DELETE` then `node scripts\demo-data.cjs delete`.

The dashboard may show synthetic workforce/leave/training figures without a visible label, as requested, but this must never be represented as actual workforce statistics in formal reporting. Synthetic identification remains internal.
