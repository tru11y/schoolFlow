-- DropIndex
DROP INDEX "attendance_records_studentId_date_key";

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "sessionId" UUID;

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "subject" TEXT,
    "slotId" UUID,
    "date" DATE NOT NULL,
    "recorderId" UUID NOT NULL,
    "teacherId" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "offsetMinutes" INTEGER,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_sessions_schoolId_date_idx" ON "attendance_sessions"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_slotId_date_key" ON "attendance_sessions"("slotId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_studentId_date_idx" ON "attendance_records"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_sessionId_studentId_key" ON "attendance_records"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "timetable_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_recorderId_fkey" FOREIGN KEY ("recorderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

