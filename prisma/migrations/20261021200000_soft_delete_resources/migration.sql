-- AlterTable
ALTER TABLE "curriculum_chapters" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "attendance_sessions" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "logbook_entries" ADD COLUMN "deletedAt" TIMESTAMP(3);
