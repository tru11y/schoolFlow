-- CreateTable
CREATE TABLE "timetable_shares" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "timetable_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timetable_shares_token_key" ON "timetable_shares"("token");

-- CreateIndex
CREATE INDEX "timetable_shares_schoolId_idx" ON "timetable_shares"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_shares_schoolId_level_key" ON "timetable_shares"("schoolId", "level");
