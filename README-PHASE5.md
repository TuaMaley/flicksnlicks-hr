# Flicks & Licks HRMS — Phase 5: Appraisal Cycles

This is an **additive patch** for your working Phase 4 codebase. Do not replace your whole project or the corrected Phase 4 files.

## Install
1. Copy the ZIP's `app/` directory into your project root, preserving its paths.
2. Open `prisma/schema.prisma` from your **working** project. Append the two models from `prisma/PHASE5-ADD-TO-SCHEMA.prisma.txt` at the bottom. Do NOT replace your schema. Do NOT reintroduce duplicate Phase 4 models.
3. On your local machine with the proper database URL: `npx prisma validate`, then `npx prisma db push`, then `npm run build`.
4. Commit and push to GitHub. Railway will deploy. If you use separate production DB credentials, ensure the production database schema is updated using your normal controlled migration process.
5. Visit `/appraisals/cycles` directly (or add a navigation link to this URL in your appraisal dashboard).

## Capabilities
- Create quarterly, half-yearly, or annual appraisal cycles with start, self-assessment, manager-assessment and end deadlines.
- Assign a chosen existing template to active employees by branch, department, or all employees in the logged-in user's permitted scope.
- Automatically create a standard AppraisalReview for each assigned employee, stored in PostgreSQL.
- See assignments and current review status, and close/reopen cycles.
- Existing Phase 4 self-review, manager-review and approval workflows continue to operate through the original appraisal page.

## Important limits
- This release displays deadline dates and completion status. **It does not send emails, SMS, WhatsApp or scheduled reminders**; those require an outbound messaging service and a scheduler.
- Progress derives from live appraisal reviews; no fake demo records.
- Assignment is one template per employee per cycle; repeated assignments are skipped.
- Branch dropdown currently shows branch IDs, not names.
- Avoid bulk assigning to large workforces until load testing (limit 500 employees per request).
- Existing reviews for the same employee/period may coexist; a cycle creates its own review.
- Review this patch in staging before production. It has not been tested against your live Railway environment.
