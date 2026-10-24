# Flicks & Licks HRMS — Phase 4, Performance Appraisal (initial release)

This package builds on the Phase 3 build-fix codebase and adds:
- 15 seeded, role-specific appraisal templates (initialize once from the Appraisals page as Administrator)
- Weighted KPI criteria, scores 1–5
- Employee self-assessments, manager scores, HR approval/rejection
- Scope-restricted review listing and creation
- Administrator-only soft deletion of templates with mandatory reason and audit logging
- PostgreSQL models `AppraisalTemplate` and `AppraisalReview`

## Deployment
1. BACK UP the production Railway PostgreSQL database.
2. Copy the code to your repository. If you installed the later global account-menu patch, preserve its files and merge the layout import rather than replacing the entire layout.
3. Run `npm install`, `npx prisma generate`, `npm run build`.
4. Review the schema diff, then apply `npx prisma db push` using the correct Railway DATABASE_URL. Stop on data-loss warnings.
5. Deploy, log in as Administrator, open `/appraisals`, select **Initialize 15 templates**.
6. Ensure role permissions `appraisals.view/create/edit/approve` are granted as appropriate.

## Important limitations / next iteration
- This is an initial working implementation, not the entire requested Phase 4 scope. Advanced PIPs, reports, custom template editing, scheduled review cycles, and bulk assignment are not included yet.
- Reviews cannot be hard-deleted; templates are retired (soft deleted) to preserve audit history.
- The employee directory endpoint requires `employees.view`; users without that permission cannot select other employees to create reviews.
- Managers should have `appraisals.edit` and HR `appraisals.approve`. Employees need `appraisals.view` to access the page.
- This package has not been run against your live Railway database. Test all role workflows before production use.
