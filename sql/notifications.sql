-- Additive migration; run once on the same Railway PostgreSQL database as Nexora.
CREATE TABLE IF NOT EXISTS "NexoraNotification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "companyId" TEXT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'GENERAL',
  "readAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NexoraNotification_userId_companyId_createdAt_idx" ON "NexoraNotification"("userId","companyId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NexoraNotification_userId_readAt_idx" ON "NexoraNotification"("userId","readAt");
