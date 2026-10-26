FLICKS & LICKS HRMS — PHASE 15J
Excel Payment Schedule Upload — Option A

MERGE THESE FILES INTO YOUR CURRENT PROJECT:
  lib/payroll-xlsx.ts (new)
  app/api/payroll/payments/import/route.ts (new)
  app/api/payroll/payments/template/route.ts (new)
  app/payroll/payments/page.tsx (replaces the existing Payments page)

No Prisma schema change, no new npm dependencies, no database migration.

RUN:
  npx prisma generate
  npx tsc --noEmit
  npm run build

TEST:
1. Log in as Finance. Go to Payroll > Payments and select the month.
2. Choose a Finance-approved, statutory-complete payroll batch.
3. Click Download Excel Template. Do not change Employee ID, Employee Number,
   Approved Net Salary, or Payroll Batch ID.
4. Enter Payment Method (BANK, MOMO or CASH), Recipient Name, and destination.
   Delete entire employee rows to perform a partial upload. Do not change columns.
5. Select the .xlsx file and click Validate Excel. Fix all rejected rows.
6. Click Prepare Validated Payments; confirm. No money is transferred.
7. Use a different authorized Finance user to verify the payment records.
8. Only confirm a salary PAID after real external payment evidence exists.

SAFEGUARDS:
- Server revalidates on both preview and preparation.
- Approved net salary cannot be overridden.
- Existing employee payment obligations are rejected, including failed records.
- Upload preparation and audit events are written transactionally.
- Concurrent imports for the same period are serialized in PostgreSQL.
- Maximum file size 1MB, maximum 1000 employee rows.
- Upload file itself is not persisted.
- Uploaded recipient/destination values ARE persisted in existing PayrollPayment
  fields as plain text, exactly like the existing manual entry. Before real
  banking details are used, implement encryption-at-rest, restricted access,
  retention policy, and provider-specific destination validation.
- The existing full-batch Prepare Schedule button remains available. If you
  have partially imported a batch, use Excel for the remaining employees.

LIMITATIONS:
- Supports normal unencrypted .xlsx template (first worksheet).
- Entire upload is rejected if any row is invalid; use corrected file.
- Does not send payments or generate bank-specific instruction formats.
- Tested XLSX writer/reader locally against Python openpyxl; full Next.js
  build and live Railway integration not executed in this environment.
