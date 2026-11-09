-- Run on the production PostgreSQL database BEFORE deploying the application code.
CREATE TABLE IF NOT EXISTS "NexoraIdleSession" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NexoraIdleSession_userId_idx" ON "NexoraIdleSession"("userId");
CREATE INDEX IF NOT EXISTS "NexoraIdleSession_lastActivityAt_idx" ON "NexoraIdleSession"("lastActivityAt");
