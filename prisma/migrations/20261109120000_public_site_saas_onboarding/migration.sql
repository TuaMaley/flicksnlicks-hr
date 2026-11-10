-- Phase 17: Public website & hybrid SaaS onboarding. ADDITIVE ONLY — creates three new tables, alters nothing.
-- Equivalent to what `npx prisma db push` creates from prisma/schema.prisma. Safe to re-run.

CREATE TABLE IF NOT EXISTS "CompanyRegistration" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SELF_SERVICE',
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "companyName" TEXT NOT NULL,
  "companyNameKey" TEXT NOT NULL,
  "companyType" TEXT,
  "registrationNumber" TEXT,
  "registrationNumberKey" TEXT,
  "taxIdentifier" TEXT,
  "taxIdentifierKey" TEXT,
  "businessAddress" TEXT,
  "digitalAddress" TEXT,
  "country" TEXT NOT NULL DEFAULT 'Ghana',
  "city" TEXT,
  "industry" TEXT,
  "employeeBand" TEXT,
  "companyEmail" TEXT NOT NULL,
  "companyEmailDomain" TEXT,
  "companyPhone" TEXT,
  "phoneKey" TEXT,
  "website" TEXT,
  "contactName" TEXT,
  "contactPosition" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "adminName" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "adminPhone" TEXT,
  "adminJobTitle" TEXT,
  "planId" TEXT,
  "planName" TEXT,
  "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  "notes" TEXT,
  "duplicateFlags" JSONB,
  "termsAcceptedAt" TIMESTAMP(3),
  "emailTokenHash" TEXT,
  "emailTokenExpiresAt" TIMESTAMP(3),
  "emailVerifiedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  "companyId" TEXT,
  "companyCode" TEXT,
  "adminUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyRegistration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyRegistration_reference_key" ON "CompanyRegistration"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyRegistration_emailTokenHash_key" ON "CompanyRegistration"("emailTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyRegistration_companyId_key" ON "CompanyRegistration"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_status_createdAt_idx" ON "CompanyRegistration"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_companyNameKey_idx" ON "CompanyRegistration"("companyNameKey");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_adminEmail_idx" ON "CompanyRegistration"("adminEmail");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_companyEmailDomain_idx" ON "CompanyRegistration"("companyEmailDomain");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_registrationNumberKey_idx" ON "CompanyRegistration"("registrationNumberKey");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_taxIdentifierKey_idx" ON "CompanyRegistration"("taxIdentifierKey");
CREATE INDEX IF NOT EXISTS "CompanyRegistration_ipHash_createdAt_idx" ON "CompanyRegistration"("ipHash", "createdAt");

CREATE TABLE IF NOT EXISTS "CompanyInvitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "registrationId" TEXT,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyInvitation_tokenHash_key" ON "CompanyInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "CompanyInvitation_companyId_createdAt_idx" ON "CompanyInvitation"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "CompanyInvitation_userId_idx" ON "CompanyInvitation"("userId");
CREATE INDEX IF NOT EXISTS "CompanyInvitation_registrationId_idx" ON "CompanyInvitation"("registrationId");

CREATE TABLE IF NOT EXISTS "WebsiteLead" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "companyName" TEXT,
  "jobTitle" TEXT,
  "country" TEXT,
  "employeeBand" TEXT,
  "topic" TEXT,
  "message" TEXT,
  "preferredTime" TEXT,
  "internalNote" TEXT,
  "handledById" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebsiteLead_kind_status_createdAt_idx" ON "WebsiteLead"("kind", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteLead_ipHash_createdAt_idx" ON "WebsiteLead"("ipHash", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteLead_email_idx" ON "WebsiteLead"("email");
