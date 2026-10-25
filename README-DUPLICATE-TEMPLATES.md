# Phase 4 — Duplicate Appraisal Templates

This patch builds on **phase4-edit-template-kpis.zip**.

## Installation
Copy the files into the matching paths in the existing Phase 4 repository:

- `app/appraisals/page.tsx` — replaces the appraisal page, preserving KPI editing.
- `app/api/appraisals/templates/[id]/duplicate/route.ts` — adds a new authenticated POST endpoint.

Run `npm run build`, commit, and deploy. No Prisma schema migration is required.

## Workflow
1. Sign in with `appraisals.create` permission.
2. Open Performance Appraisal and click **Duplicate template** on an existing template.
3. Give the copy a **unique name** and click **Create copy**.
4. Select **Edit KPIs** on the new template to customize the criteria.

The new template copies category, level, description, and KPI weights. It has a new ID and no linked reviews. Original appraisals are not modified. Duplication is audit logged. The original must be active and not retired. Existing names are protected by a unique database constraint.

**Note:** This patch has not been tested against the live Railway instance. Test on a staging database or with a backup first.
