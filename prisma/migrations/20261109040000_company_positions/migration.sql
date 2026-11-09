CREATE TABLE IF NOT EXISTS "CompanyPosition" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyPosition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPosition_companyId_name_key" ON "CompanyPosition"("companyId", "name");
CREATE INDEX IF NOT EXISTS "CompanyPosition_companyId_idx" ON "CompanyPosition"("companyId");
