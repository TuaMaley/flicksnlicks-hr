CREATE TABLE "NexHrChatThread" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "title" VARCHAR(180) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "NexHrChatThread_companyId_userId_updatedAt_idx" ON "NexHrChatThread"("companyId","userId","updatedAt");
CREATE TABLE "NexHrChatMessage" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "threadId" TEXT NOT NULL,
 "role" TEXT NOT NULL,
 "content" TEXT NOT NULL,
 "citations" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NexHrChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "NexHrChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NexHrChatMessage_threadId_createdAt_idx" ON "NexHrChatMessage"("threadId","createdAt");
