-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR';

-- AlterTable
ALTER TABLE "student_profiles" DROP COLUMN "birthDate";

-- AlterTable
ALTER TABLE "timetable_slots" ADD COLUMN     "curriculumChapterId" UUID;

-- CreateTable
CREATE TABLE "curriculum_chapters" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curriculum_chapters_schoolId_level_idx" ON "curriculum_chapters"("schoolId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_chapters_schoolId_level_subject_position_key" ON "curriculum_chapters"("schoolId", "level", "subject", "position");

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_curriculumChapterId_fkey" FOREIGN KEY ("curriculumChapterId") REFERENCES "curriculum_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

