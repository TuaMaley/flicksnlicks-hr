# Phase 4 — Create Appraisal Templates from Scratch

This patch **builds on** the earlier KPI Editor and Duplicate Template patches.

## Install
Copy the `app/` folder contents into the matching paths of your Next.js HRMS repository. Replace the two files listed below and keep other files unchanged:

- `app/appraisals/page.tsx` — replace (retains Edit KPIs and Duplicate Template)
- `app/api/appraisals/templates/route.ts` — replace (adds validated create + duplicate-name handling)

## How to use
Sign in with `appraisals.create` permission. Open Performance Appraisal → **+ Create New Template**. Enter a unique name, category, employee level, optional description, and 1–20 KPIs with integer weights adding to exactly 100%. Click **Save New Template**.

Templates are saved to PostgreSQL using the existing Prisma model; no schema migration required. Server-side permissions, validations, audit logging, and duplicate-name handling are included. Existing reviews and templates remain unchanged.

Run `npm run build` before pushing to GitHub and redeploying Railway. This patch has not been tested against your live deployment.
