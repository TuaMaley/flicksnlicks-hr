# HR rejection reason / manager return patch

Replace these three files in your existing Next.js project:
- `app/api/appraisals/reviews/[id]/route.ts`
- `app/api/appraisals/reviews/route.ts`
- `app/appraisals/page.tsx`

Changes:
- HR returning an appraisal sets status to `REJECTED` rather than `MANAGER_REVIEWED`.
- Manager can re-evaluate a returned appraisal (REJECTED with existing manager scores), save it as MANAGER_REVIEWED, then forward it to HR again.
- Manager sees the latest rejection reason prominently when opening a rejected appraisal. The reason is read from the existing `AuditLog.detail.reason` stored by the rejection action.
- Employee-rejected appraisals (REJECTED with no manager scores) still go back to the employee for resubmission.
- No schema migration required if your Phase 6 statuses and AuditLog are already deployed.

Test: HR returns a PENDING_HR_APPROVAL review with a 10+ character reason; manager sees Rejected status and reason; manager saves revised evaluation and forwards it to HR.

Run `npx prisma generate`, `npx tsc --noEmit`, and `npm run build` before deployment. This patch has not been verified against a complete install of your live project.
