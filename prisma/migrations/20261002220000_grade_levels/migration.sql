-- CreateTable
CREATE TABLE "grade_levels" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "monthlyFee" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grade_levels_schoolId_name_key" ON "grade_levels"("schoolId", "name");


-- Data migration: one level per distinct level already used by students
INSERT INTO "grade_levels" ("id", "schoolId", "name", "position")
SELECT gen_random_uuid(), "schoolId", "level", (ROW_NUMBER() OVER (PARTITION BY "schoolId" ORDER BY "level") - 1)::int
FROM (SELECT DISTINCT "schoolId", "level" FROM "student_profiles") t;
