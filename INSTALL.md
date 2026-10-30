# Nexora ESS — My Training & My Requests

## What this patch adds
- My Training: read-only view of your own TrainingEnrollment records, courses, attendance and evaluation submission status.
- My Requests: employee-submitted HR requests with history and status tracking. Categories: general, documents, employment verification, payroll, other.
- Existing ESS tabs are retained. Announcements stays disabled.
- Employees can only see their own records. Submission requires `selfservice.edit`, viewing requires `selfservice.view`.

## Install (Windows CMD)
1. Back up your project and PostgreSQL database.
2. Extract ZIP into your project root, retaining paths. Overwrite `app/self-service/page.tsx` only after backing it up.
3. In the project root run:
   `python apply_ess_request_schema.py`
   (This appends the `EmployeeHRRequest` model to your existing Prisma schema without replacing your other models.)
4. Review the appended model, then run:
   `npx prisma validate`
   `npx prisma db push`
   `npx prisma generate`
   `npx tsc --noEmit`
   `npm run build`
5. Deploy only if successful:
   `git add app/self-service/page.tsx app/api/self-service/training app/api/self-service/requests prisma/schema.prisma`
   `git commit -m "Add ESS training and HR requests"`
   `git push`

## Important
- A NEW additive Prisma table is required for My Requests. No `--force-reset`, no `migrate reset`, no destructive database operation.
- The new model has no required relation fields, avoiding changes to Employee/User models.
- Existing HR request approval or response UI is NOT included: requests will initially remain PENDING until a separate HR administration workflow is implemented. Do not promise automated approval or delivery.
- Training tab is read-only and displays existing HR-managed enrollment records; it does not let staff self-enroll.
- `EmployeeHRRequest` is separate from LeaveRequest and cannot alter leave balances or approvals.
- No full-project TypeScript/Next build has been performed; validate against your current code and schema.
- The UI includes the latest supplied ESS Phase 3/4 syntax correction. Do not install an older `page.tsx` afterward.
