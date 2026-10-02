-- CreateTable
CREATE TABLE "guardian_links" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "parentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_links_schoolId_idx" ON "guardian_links"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_links_parentId_studentId_key" ON "guardian_links"("parentId", "studentId");

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

