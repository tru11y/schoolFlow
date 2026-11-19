-- AlterTable
ALTER TABLE "logbook_entries" ADD COLUMN "chapterLabel" TEXT;

-- Seed the free-text chapter from the previously linked curriculum chapter.
UPDATE "logbook_entries" e
SET "chapterLabel" = 'Ch. ' || c."position" || ' : ' || c."title"
FROM "curriculum_chapters" c
WHERE e."chapterId" = c."id" AND e."chapterLabel" IS NULL;
