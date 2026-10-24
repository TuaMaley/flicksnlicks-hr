# Phase 4 — Editable KPIs for Appraisal Templates

Replace these **two** files in your deployed Phase 4 repository:

- `app/appraisals/page.tsx`
- `app/api/appraisals/templates/[id]/route.ts`

Authorized users with `appraisals.edit` can open **Edit KPIs** on a template, add/remove/rename KPIs, and set weights. Weights must total 100%; 1–20 KPIs; unique names. Updates are persisted to the existing PostgreSQL `AppraisalTemplate.criteria` JSON field and audited.

**Historical integrity:** templates that have any appraisal reviews cannot be edited. Create a new version/template instead, so previously scored evaluations are unchanged.

No database migration is required. Build with `npm run build`, commit, redeploy.
