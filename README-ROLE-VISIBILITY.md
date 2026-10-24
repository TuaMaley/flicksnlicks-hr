# Role-aware module visibility

This release builds on Phase 3 Leave Management. After login, the dashboard fetches effective permission keys from `/api/me` and shows only modules whose corresponding `.view` permission is granted. The visibility changes when the administrator edits role permissions or user role assignments and the user reloads their page.

Protected routes `/employees`, `/leave`, `/access`, and `/access/users` now have server-side permission checks in addition to the existing API authorization. These checks do not rely on hiding sidebar items.

**Deployment:** Back up PostgreSQL, replace your GitHub project with this package, and redeploy on Railway. No database schema changes are required. Test with separate accounts for Employee, Manager, HR and Administrator.

**Limitations:** Other module screens are still placeholders. The dashboard's illustrative cards are not permission-filtered data reports; do not treat them as actual HR data. Existing API authorization should be reviewed for every newly implemented module.
