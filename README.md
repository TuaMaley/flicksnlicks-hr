# Phase 10 — Performance Improvement Plans (PIP)

This is an ADDITIVE patch for the Flicks & Licks HRMS (Next.js 15 / Prisma 6 / PostgreSQL). It does not overwrite existing appraisal screens or API routes.

## Installation
1. Back up your PostgreSQL database and your repository.
2. Copy the `app/` folder contents into your project, preserving paths.
3. In `prisma/schema.prisma`, add the two models from `prisma/PIP-MODELS.prisma.txt` **once** and add `improvementPlans PerformanceImprovementPlan[]` **inside the existing Employee model**. Do not paste the instructional comments as Prisma declarations.
4. Run `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit`, `npm run build`.
5. Apply schema to the correct database after reviewing the changes: `npx prisma db push` (do not accept destructive warnings). For production, a reviewed Prisma migration is preferable.
6. Deploy to Railway and open `/pips`.
7. Add a link to `/pips` on the Appraisal page if desired; this package deliberately does not overwrite your latest appraisal page.

## Access and workflow
- Users require existing `appraisals.view` to read plans in their authorized employee scope.
- HR, Administrator and Branch Manager roles with `appraisals.edit` can create plans, activate them and record progress within scope.
- HR/Administrator with `appraisals.approve` can close a plan with a documented outcome.
- Employees with appraisal viewing permission may see their own plan; employeeWhere() blocks other employees.
- A user cannot create/act on their own PIP.
- PIP states: DRAFT → ACTIVE → COMPLETED / UNSUCCESSFUL / CANCELLED.
- Progress check-ins and state changes are audit logged. The data comes from PostgreSQL, not demo records.

## Important limitations
- No automatic PIP assignment based on appraisal scores; HR should initiate based on approved policy.
- Employee ID is entered manually in the initial creation form; a searchable selector can be added later.
- No notification emails, attachments, employee acknowledgment, or PDF export yet.
- Full production build has not been executed against your latest deployed repository. Integrate carefully, especially if your Prisma schema has local modifications.
