CREATE TABLE "NexHrAnswerFeedback" (
 "id" TEXT NOT NULL,
 CONSTRAINT "NexHrAnswerFeedback_pkey" PRIMARY KEY ("id"),
 "companyId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "messageId" TEXT NOT NULL,
 "rating" TEXT NOT NULL,
 "comment" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NexHrAnswerFeedback_messageId_key" ON "NexHrAnswerFeedback"("messageId");
CREATE INDEX "NexHrAnswerFeedback_companyId_createdAt_idx" ON "NexHrAnswerFeedback"("companyId","createdAt");
