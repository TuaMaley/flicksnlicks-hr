-- Run once against the correct PostgreSQL database after backing it up.
-- HR Manager gets dashboard access by default; Administrator does NOT.
-- Administrator may grant the privilege to other editable roles using Access > Roles.
INSERT INTO "Permission" ("id", "key", "description")
VALUES ('perm_appraisals_analytics_view', 'appraisals.analytics.view', 'View performance appraisal analytics dashboard')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" = 'HR Manager' AND p."key" = 'appraisals.analytics.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
