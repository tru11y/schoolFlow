-- AlterTable
ALTER TABLE "payments" ADD COLUMN "period" TEXT;

-- Backfill the payment month from the recorded date.
UPDATE "payments" SET "period" = to_char("paidAt", 'YYYY-MM') WHERE "period" IS NULL;

-- CreateIndex
CREATE INDEX "payments_schoolId_period_idx" ON "payments"("schoolId", "period");
