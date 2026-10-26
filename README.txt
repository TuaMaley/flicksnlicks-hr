Phase 15I.1 — Advanced Payroll Reports & Management Analytics

Merge app/ into the project that ALREADY has Phase 15I installed. Do not replace other app files.
Adds: six-month trends and month-over-month gross variance, printable management report (browser Print > Save as PDF), filtered employee-level PAYE, pension, overtime, payment and full payroll Excel-compatible CSV schedules.
No Prisma schema change. Read-only routes.
Run: npx prisma generate; npx tsc --noEmit; npm run build.
Important: historical zeros can mean missing approved data; exports are NOT official tax/SSNIT submission formats. Keep confidential.
