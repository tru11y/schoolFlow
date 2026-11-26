-- CreateTable
CREATE TABLE "collection_sheets" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "csv" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "totalDueCents" INTEGER NOT NULL,
    "totalPaidCents" INTEGER NOT NULL,
    "totalRemainingCents" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_sheets_schoolId_generatedAt_idx" ON "collection_sheets"("schoolId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "collection_sheets_schoolId_period_key" ON "collection_sheets"("schoolId", "period");
