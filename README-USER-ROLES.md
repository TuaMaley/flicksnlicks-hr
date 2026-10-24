# Phase 3 extension: User & Role Assignment

This release extends the previous Phase 3 project without changing the PostgreSQL schema.

## What changed
- `/access/users`: user directory, create user, assign multiple roles, edit roles, set account status, optional password reset, branch/department access scopes.
- `/api/users/[id]`: protected transactional role/scope updates with audit logging and last-administrator protections.
- `/api/access/options`: options for active roles, branches, departments, and employees.
- `/access`: navigation to the new user assignment screen.
- Employee registration and editing remain restricted to Administrator and HR Manager **even if a custom role receives the employee-create or employee-edit permission**.

## Deploy
1. Back up your PostgreSQL database.
2. Upload the extracted `flicks-hrms` project to your existing GitHub repository; keep your existing Railway environment variables.
3. Deploy to Railway. No schema changes are needed for this extension if Phase 3 schema was already deployed.
4. Sign in as Administrator and open **Access & Audit Controls → Manage Users**.
5. Create a test user with the Branch Manager / Department Head role and one branch scope. Confirm they cannot see employees outside their assigned scope or register employees.

## Security and operational notes
- Only users with `access.users.manage` can use user-management endpoints; protected Administrator assignments require an active Administrator.
- Branch/department scopes limit employee queries, but global Administrator/HR roles retain their existing global access.
- Scope assignments do not grant permissions; they restrict the records available to permitted operations.
- Changes to roles, scopes, status, and password resets are recorded in `audit_logs` without recording passwords.
- User creation currently requires an administrator-supplied temporary password; add a password-change-on-first-login flow and login rate limiting before broad production use.
- Verify production build, authorization, audit events, and backups on your Railway deployment before entering real HR records.
