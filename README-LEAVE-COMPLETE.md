# Flicks & Licks — Leave Management completion

Based on Phase 3 User & Role Assignment package. Preserves existing HRMS files and logo.

## New features
- Leave dashboard, balances, calendar, reports, policy configuration.
- PostgreSQL LeavePolicy and LeaveEntitlement tables; LeaveRequest tracks days and review stage.
- Entitlements and balances calculated by calendar year, using Monday–Friday weekdays (public holidays not excluded).
- Zero default entitlements: HR must configure policy or employee entitlements before requests can be submitted. This intentionally avoids guessing Ghana leave policies.
- Two-step workflow by default: a manager/HR with leave.approve reviews first, then a **different** HR/Administrator gives final approval. HR can configure one-step approval.
- Only requests with final APPROVED status count as used days; pending requests reserve days when creating new requests. Cancelling approved leave restores balance automatically.
- Scope-based employee visibility, own-request restrictions, audit entries.

## Deploy
1. Back up your Railway PostgreSQL database.
2. Commit this package to the existing GitHub repository.
3. Run `npx prisma db push` with Railway DATABASE_URL (prefer a reviewed Prisma migration for production).
4. Deploy to Railway. No bootstrap required if roles and permissions already exist.
5. HR: Leave Management > Policies, set entitlements and approval steps. Assign per-employee entitlements under Balances when necessary.

## Known limitations / follow-ups
- Workdays count Monday–Friday; public holidays, employee-specific schedules, accrual, carryover and statutory policy validation are NOT implemented.
- Dashboard stats and CSV cover up to 500 visible records; implement server-side pagination and aggregate reports for large datasets.
- Current existing login/session architecture needs production security review (CSRF, rate limiting, session invalidation).
- Review workflow assumes manager permission leave.approve and HR/Administrator final approval; organizational reporting lines are not modeled.
- Not tested against a live Railway database.
