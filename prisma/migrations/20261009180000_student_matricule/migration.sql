-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN "matricule" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_schoolId_matricule_key" ON "student_profiles"("schoolId", "matricule");
