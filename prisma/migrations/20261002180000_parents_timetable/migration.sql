-- CreateTable
CREATE TABLE "parent_contacts" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "level" TEXT,
    "studentId" UUID,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "teacherId" UUID,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parent_contacts_schoolId_idx" ON "parent_contacts"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_contacts_studentId_position_key" ON "parent_contacts"("studentId", "position");

-- CreateIndex
CREATE INDEX "timetable_slots_schoolId_level_idx" ON "timetable_slots"("schoolId", "level");

-- CreateIndex
CREATE INDEX "timetable_slots_studentId_idx" ON "timetable_slots"("studentId");

-- AddForeignKey
ALTER TABLE "parent_contacts" ADD CONSTRAINT "parent_contacts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Data migration: legacy single parent -> primary parent_contacts row
INSERT INTO "parent_contacts" ("id", "schoolId", "studentId", "position", "name", "relation", "phone", "email")
SELECT gen_random_uuid(), "schoolId", "userId", 0, "parentName", 'Tuteur légal',
       CASE WHEN "parentContact" LIKE '%@%' THEN NULL ELSE "parentContact" END,
       CASE WHEN "parentContact" LIKE '%@%' THEN "parentContact" ELSE NULL END
FROM "student_profiles";

-- AlterTable
ALTER TABLE "student_profiles" DROP COLUMN "parentContact",
DROP COLUMN "parentName";
