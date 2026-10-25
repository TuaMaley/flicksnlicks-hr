# Phase 9 — Employee Performance History

## What it adds
- Historical reviews by employee, ordered newest first; statuses, periods, scores, self-ratings, manager ratings, and comments.
- Summary of completed reviews (FINALIZED and legacy APPROVED), average completed score, latest completed period.
- Employee selector for authorized HR and management users, constrained by the existing `employeeWhere` reporting scope.
- Employees with `appraisals.view` can view their own history. Their manager evaluation and final score are withheld until FINALIZED or legacy APPROVED.
- Uses existing PostgreSQL `AppraisalReview` data; no schema migration or seed data.

## Installation
1. Back up the current code and database.
2. Add `app/api/appraisals/history/route.ts` and `app/appraisals/history/page.tsx`.
3. `app/appraisals/page.tsx` is included only to add a navigation link; **merge that link** into your current page if you have made more recent changes. It is based on the Phase 8A delegated analytics page.
4. Run `npx prisma generate`, `npx tsc --noEmit`, `npm run build` and redeploy.
5. Open `/appraisals/history`. Test with HR, scoped manager, employee, and an out-of-scope employee ID (must be HTTP 403).

## Important limitations
- No separate historical KPI snapshot is stored in AppraisalReview; this displays recorded score maps and the current template name. Template changes could affect interpretation of historical KPIs.
- Up to 200 reviews per employee and 1,000 employee-selector options are returned; pagination/search can be added for large organizations.
- `appraisals.view` is required. HR/admin users without that permission cannot open history.
- No live PostgreSQL or full production build has been performed against your deployed repository.
