# Phase 5 navigation repair

Restores the full Phase 4 appraisal workspace at /appraisals, adds a link to /appraisals/cycles, and routes the dashboard Performance Appraisal menu to /appraisals.

## Installation
1. Back up your existing app/page.tsx and app/appraisals/page.tsx.
2. Replace ONLY these two files using the same paths in this ZIP.
3. Keep the existing app/appraisals/cycles/page.tsx and Phase 5 API routes. Do not replace or remove them.
4. Check for app/appraisals/layout.tsx or middleware.ts redirects if /appraisals still redirects after deployment.
5. Run npm run build, commit the two files, and redeploy.

No Prisma or PostgreSQL changes required.

Note: This patch uses the last known working Phase 4 appraisal page and dashboard source. If you have made newer changes to these exact files, merge the changes instead of replacing them blindly.
