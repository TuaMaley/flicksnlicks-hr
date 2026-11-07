CREATE TABLE IF NOT EXISTS "CompanyPlanPrice" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "planId" TEXT NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'GHS',
 "monthlyPrice" DECIMAL(12,2) NOT NULL, "annualPrice" DECIMAL(12,2) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CompanyPlanPrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPlanPrice_companyId_planId_key" ON "CompanyPlanPrice"("companyId","planId");
CREATE INDEX IF NOT EXISTS "CompanyPlanPrice_companyId_idx" ON "CompanyPlanPrice"("companyId");
