# Nexora Recruitment — Phase 1

## Installation
1. Back up the working project and PostgreSQL database.
2. Copy `prisma/schema.prisma`, `app/recruitment/`, and `app/api/recruitment/requisitions/` into the project, preserving paths.
3. The existing `app/components/NexoraModuleTabs.tsx` and `.css` must remain installed; they are not overwritten.
4. Add `recruitment.view`, `recruitment.create`, and `recruitment.approve` to your permission administration/seeding process and assign them appropriately. `recruitment.approve` is currently used for both HR and management steps; separation of these roles needs a further permission refinement before production.
5. Run `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit`, then review schema changes and run `npx prisma db push` (never `--accept-data-loss`). Run `npm run build`.
6. Navigate to `/recruitment`. Ensure the sidebar points to `/recruitment` and requires `recruitment.view`.

## Scope and caveats
- This is Phase 1 only. The remaining tabs are deliberately disabled until implemented.
- Requests do not automatically create JobOpening records.
- Branch scope is derived from the existing employeeWhere helper. A branch with no employees in scope will not appear; adjust scope logic if needed.
- The management approval step blocks the original requester and HR reviewer from self-approving, but HR/management role segregation must be enforced by distinct permissions in a future security-hardening pass.
- Audit logs are written for creation and each review decision.
- Do not deploy without validating in your full project. No full application build was run in this environment.
