-- CreateTable
CREATE TABLE "copilot_threads" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "copilot_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_messages" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_threads_schoolId_userId_updatedAt_idx" ON "copilot_threads"("schoolId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "copilot_messages_threadId_createdAt_idx" ON "copilot_messages"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "copilot_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
