# Flicks & Licks HRMS — Phase 2

## Included
- Existing red/black/white dashboard and official logo
- Email/password login (scrypt hashed passwords, signed HttpOnly session cookies)
- PostgreSQL employee registration, listing, editing and status changes
- Branch filtering and branch/department-scoped employee visibility
- Configurable roles and permission matrix (create/edit custom roles)
- Server-side API authorization, audit entries for changes
- Live employee total on dashboard; **all other dashboard KPIs are still illustrative**

## Deploy to Railway
1. Upload the **contents of this project folder** to your private GitHub repository.
2. On Railway add a PostgreSQL service and a web service linked to the GitHub repository.
3. Add these web-service variables: `DATABASE_URL` (Railway PostgreSQL reference), `AUTH_SECRET` (random 32+ character value), `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters).
4. Railway build command: `npm run build`.
5. Before the first public use, run `npx prisma db push` and then `npm run db:bootstrap` with the Railway environment variables. Use Railway's CLI (`railway run npx prisma db push`, `railway run npm run db:bootstrap`) or a Railway one-off job. **Do not run bootstrap as a startup command.**
6. Railway start command: `npm run start`. Generate a public domain, open `/login`, and sign in with the bootstrap admin email/password.
7. Remove `BOOTSTRAP_ADMIN_PASSWORD` from Railway variables after successfully creating the initial administrator. Keep `AUTH_SECRET` stable or sessions will be invalidated.

Database schema sync (`prisma db push`) is intended only for the initial MVP on an empty database. Before production or schema upgrades, generate and commit reviewed Prisma migrations; never run destructive schema changes against employee data.

## Important notes
- The initial admin is created **only if no user exists**; running bootstrap again will not reset any password.
- Built-in Administrator is protected against privilege edits; other roles can be configured by authorized administrators.
- Admin and HR Manager can register employees. The Branch Manager / Department Head role only sees employees within assigned scopes, or their own linked employee profile. Scopes and user assignment currently require calling the protected `/api/users` endpoint; a graphical assignment screen is planned next.
- `/api/users` is administrator-only. Send `POST` JSON with `name`, `email`, `password`, `roleIds`, and optional `scopes` containing `branchId`/`department`. Never share credentials in source code.
- A user with only the Employee role can see their own linked employee record, not all records. Their account must be linked using `employeeId` during user creation.
- This is a Phase 2 MVP, **not production-ready for sensitive employee data** until security review, backups, password reset/MFA, rate limiting, and privacy controls are completed.
- Do not use fake sample dashboard metrics for business decisions.
