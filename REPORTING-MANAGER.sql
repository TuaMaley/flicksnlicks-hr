ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportingManagerId" TEXT;
CREATE INDEX IF NOT EXISTS "Employee_reportingManagerId_idx" ON "Employee" ("reportingManagerId");
