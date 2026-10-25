# Flicks & Licks HRMS — Appraisal Template Visibility Restriction

Only users with an ACTIVE `Administrator` or `HR Manager` role can see the Appraisal templates section (including the 15 template cards), create/duplicate/edit templates, and see the Start a new appraisal form.

Other roles (Branch Manager, Supervisor, Employee, etc.) continue to see Performance reviews and can use the appraisal workflow according to their permissions. Template data is still fetched internally because the review modal needs KPI definitions; the template gallery and management controls are hidden.

API security: template POST, PATCH, and duplicate POST now require both the corresponding permission AND an active Administrator/HR Manager role. Template GET remains available to appraisal viewers so KPI review continues to function. Administrator-only template retirement remains unchanged.

Replace these four files at the same paths in your Next.js project:
- app/appraisals/page.tsx
- app/api/appraisals/templates/route.ts
- app/api/appraisals/templates/[id]/route.ts
- app/api/appraisals/templates/[id]/duplicate/route.ts

No Prisma schema changes or migrations. Run `npx tsc --noEmit` and `npm run build`, then deploy.

NOTE: The UI file is based on Phase 6. Apply Phase 6 first if it is not already installed. This patch does not restrict visibility of template names shown as labels within actual performance reviews.
