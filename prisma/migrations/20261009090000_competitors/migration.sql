-- CreateTable
CREATE TABLE "competitors" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "contact" TEXT,
    "offers" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_fees" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "competitorId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "monthlyFee" INTEGER NOT NULL,

    CONSTRAINT "competitor_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitors_schoolId_idx" ON "competitors"("schoolId");

-- CreateIndex
CREATE INDEX "competitor_fees_schoolId_idx" ON "competitor_fees"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_fees_competitorId_level_key" ON "competitor_fees"("competitorId", "level");

-- AddForeignKey
ALTER TABLE "competitor_fees" ADD CONSTRAINT "competitor_fees_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
