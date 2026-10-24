# Flicks & Licks HRMS — Phase 3 (Leave Management)

This update is based on the user-supplied Phase 2.0 archive. Existing employee and access features are retained.

## Changes
- Employee directory: Department and Position appear in separate table columns.
- Branches: Head Office is added to the idempotent branch bootstrap and dashboard branch selectors.
- Leave Management: PostgreSQL-backed requests, status filtering, approval/rejection, mandatory rejection notes, overlapping-request validation, and audit events.
- Authorization: existing permissions and employee reporting scopes apply; only authorized approvers may decide, and self-approval is blocked.

## Railway deployment
1. Commit extracted project files to the same GitHub repository (do not upload node_modules, secrets, or `.env`).
2. Keep existing DATABASE_URL and AUTH_SECRET Railway variables.
3. **Before deploying app traffic**, run `npx prisma db push` once against your Railway PostgreSQL database (for example via Railway CLI in a controlled environment). This adds nullable leave decision fields without dropping existing employee data. Back up the database first. For production long-term, replace db push with a reviewed Prisma migration.
4. Run `npm run db:branches` with the Railway DATABASE_URL, or `npm run db:bootstrap` if your admin bootstrap variables are configured. Both seed Head Office without duplicating existing branches.
5. Redeploy app; build command `npm run build`, start command `npm run start`.

**Do not run `prisma migrate reset` on production.**

## Scope
- Leave balances, accrual rules, public holidays, automatic payroll adjustments and calendar views are not yet implemented.
- Dashboard KPI cards other than the employee count still show illustrative values; the Leave Management page uses real records.
- Employee self-service form and individual employee scope will be expanded in a later phase.
- Existing custom roles need `leave.view`, `leave.create`, or `leave.approve` assigned as appropriate.
