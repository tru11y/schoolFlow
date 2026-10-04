-- CreateTable
CREATE TABLE "ai_reports" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_reports_schoolId_scope_day_key" ON "ai_reports"("schoolId", "scope", "day");
