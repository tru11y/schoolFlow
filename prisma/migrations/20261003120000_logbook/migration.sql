-- CreateTable
CREATE TABLE "logbook_entries" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "teacherId" UUID NOT NULL,
    "slotId" UUID,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "homework" TEXT,
    "homeworkDue" DATE,
    "chapterId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logbook_entries_pkey" PRIMARY KEY ("id")
);

-- Data migration: former free-form notes become entries of the school's first level (they had no class).
INSERT INTO "logbook_entries" ("id", "schoolId", "level", "subject", "teacherId", "date", "title", "content", "createdAt", "updatedAt")
SELECT h."id", h."schoolId",
       COALESCE((SELECT g."name" FROM "grade_levels" g WHERE g."schoolId" = h."schoolId" ORDER BY g."position", g."name" LIMIT 1), 'Toutes classes'),
       'Général', h."authorId", h."createdAt"::date, h."title", h."content", h."createdAt", h."createdAt"
FROM "homeworks" h;

-- DropForeignKey / DropTable
ALTER TABLE "homeworks" DROP CONSTRAINT "homeworks_authorId_fkey";
DROP TABLE "homeworks";

-- CreateIndex
CREATE INDEX "logbook_entries_schoolId_level_date_idx" ON "logbook_entries"("schoolId", "level", "date");
CREATE UNIQUE INDEX "logbook_entries_slotId_date_key" ON "logbook_entries"("slotId", "date");

-- AddForeignKey
ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "timetable_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "curriculum_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
