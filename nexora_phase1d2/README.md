# Nexora Phase 1D.2 — Conservative FNL001 backfill

## Scope
This patch updates ONLY `scripts/tenant-backfill.cjs`. It does not change Prisma schema, APIs, permissions, or database tables. It does not provide tenant isolation.

## Important safeguards
- Dry-run by default; no data writes unless explicitly applied.
- Requires active company `FNL001` and **no other registered companies**.
- Refuses any records already owned by another company.
- Updates only `companyId: null`; never deletes records or changes an existing company assignment.
- Atomic transaction, serializable isolation, and count reconciliation before commit.
- **AuditLog excluded** because platform administration and operational audits cannot be reliably distinguished using this script. Existing audit rows remain unchanged.
- Existing `Role` and `GhanaPayrollPolicy` rows are assigned to FNL001 based on the stated assumption that all existing company-specific operational configuration belongs to Flicks n Licks. Confirm this assumption before applying.

## Installation (Windows CMD)
1. Back up your Railway PostgreSQL database and verify restore access. Prefer testing on a staging clone first.
2. Copy `scripts/tenant-backfill.cjs` into your project, replacing the existing file. Keep a copy of the original.
3. Confirm `DATABASE_URL` points to the intended database; do not share its value.
4. Run dry-run: `node scripts\tenant-backfill.cjs`
5. Review counts and confirm FNL001 is the correct owner of the operational data.
6. ONLY after successful staging testing and backup, to apply from Windows CMD:
   `set NEXORA_BACKFILL_CONFIRM=FNL001`
   `node scripts\tenant-backfill.cjs --apply`
7. Run `node scripts\tenant-backfill.cjs` again; the included operational models should have 0 unassigned rows. AuditLog is deliberately excluded.
8. Test logins, platform dashboard, employee records, leave, payroll, appraisals and company settings.

## Caveats
- The script cannot prove employee-to-branch or other cross-table relationships are correct. Verify key workflows after applying.
- The script does not classify platform audit logs. Do not add NOT NULL constraints to AuditLog.companyId until platform events are modeled appropriately.
- This script does not secure tenant-specific API endpoints or enforce row-level isolation. Do not onboard external customers yet.
- Concurrent production writes may cause a serializable transaction conflict; retry only after reviewing the error and rerunning the dry-run.
