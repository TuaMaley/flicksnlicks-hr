CREATE TABLE "NexHrDocument" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "familyId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "title" TEXT NOT NULL, "category" TEXT NOT NULL, "description" TEXT,
 "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "fileData" BYTEA NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "visibility" TEXT NOT NULL DEFAULT 'ALL_EMPLOYEES',
 "effectiveAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "uploadedById" TEXT NOT NULL,
 "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "reviewReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "NexHrDocument_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NexHrDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NexHrDocument_companyId_familyId_version_key" ON "NexHrDocument"("companyId","familyId","version");
CREATE INDEX "NexHrDocument_companyId_status_category_idx" ON "NexHrDocument"("companyId","status","category");
CREATE INDEX "NexHrDocument_companyId_familyId_idx" ON "NexHrDocument"("companyId","familyId");
CREATE TABLE "NexHrAuditEvent" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "documentId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "action" TEXT NOT NULL, "detail" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NexHrAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NexHrAuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "NexHrAuditEvent_companyId_documentId_createdAt_idx" ON "NexHrAuditEvent"("companyId","documentId","createdAt");
INSERT INTO "Permission" ("id","key","description") VALUES
 ('nexhr-view','nexhr.view','View approved company knowledge'),
 ('nexhr-manage','nexhr.manage','Upload and manage company knowledge'),
 ('nexhr-approve','nexhr.approve','Approve or reject company knowledge')
 ON CONFLICT ("key") DO NOTHING;
-- Grant existing company-scoped roles; do not grant permissions to platform administrators or across companies.
INSERT INTO "RolePermission" ("roleId","permissionId")
 SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
 WHERE r."companyId" IS NOT NULL AND r."active" = true
 AND ((p."key"='nexhr.view') OR (p."key" IN ('nexhr.manage','nexhr.approve') AND
 (lower(r."name") LIKE '%hr manager%' OR lower(r."name") LIKE '%administrator%')))
 ON CONFLICT DO NOTHING;
INSERT INTO "CompanyModule" ("companyId","moduleKey","enabled","createdAt","updatedAt")
 SELECT "id",'nexhr',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM "Company" WHERE "active"=true
 ON CONFLICT ("companyId","moduleKey") DO NOTHING;
