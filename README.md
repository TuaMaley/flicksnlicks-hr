# Phase 8A: HR-default, Administrator-delegated performance analytics

## Behavior
- Only the HR Manager role is granted `appraisals.analytics.view` by default.
- Administrator has no automatic dashboard access. They can grant/revoke `appraisals.analytics.view` to editable roles under Access > Roles (assuming they have `access.roles.manage`).
- Both the analytics API and navigation link check the same permission. A guessed URL returns HTTP 403 without the grant.
- Data scope remains enforced by `employeeWhere(a)`; granting access does not expand branch/department visibility. HR Manager retains its existing company-wide scope.
- Appraisal templates and approval workflow are unchanged.

## Install
1. Back up the application and PostgreSQL database.
2. Copy the 4 `.ts`/`.tsx` files from this ZIP to the corresponding project paths. **Merge** `app/appraisals/page.tsx` if you have newer custom changes; the only new element there is the conditional dashboard link.
3. Verify DATABASE_URL points to the intended database. Execute SQL using: `npx prisma db execute --file prisma/phase8a_analytics_permission.sql --schema prisma/schema.prisma` (Prisma 6).
4. `npx prisma generate && npx tsc --noEmit && npm run build` and redeploy.
5. Sign in as HR Manager (dashboard visible), Administrator (hidden by default), and Branch Manager (hidden by default). Grant `appraisals.analytics.view` to an editable role from Administrator > Access > Roles, then test it becomes visible.

## Caveats
- The permission must be created in PostgreSQL by the included SQL; `prisma db push` does not create permission records.
- If your HR Manager role has been renamed, change the name in the SQL before running.
- The existing Roles API refuses editing protected roles; delegation works for editable roles.
- Existing users with multiple roles inherit the union of those roles' privileges.
- No live DB or full project build was available for testing.
