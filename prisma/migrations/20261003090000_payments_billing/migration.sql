-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'TRANSFER');

-- AlterEnum (the new values are not used inside this migration)
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "InvoiceStatus" ADD VALUE 'OVERDUE';

-- AlterTable (receiptHash is dropped further down, after its data is moved to payments)
ALTER TABLE "invoices"
ADD COLUMN     "carriedOverCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "carriedToInvoiceId" UUID,
ADD COLUMN     "paidCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "period" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "description" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" UUID NOT NULL,
    "receiptHash" CHAR(64) NOT NULL,
    "allocations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Data migration: every invoice that was fully paid becomes a payment.
-- payments.id = invoices.id keeps the existing receipt hashes valid (same certified facts).
UPDATE "invoices" SET "paidCents" = "amountCents" WHERE "status" = 'PAID';

INSERT INTO "payments" ("id", "schoolId", "studentId", "amountCents", "method", "description", "paidAt", "recordedById", "receiptHash", "allocations")
SELECT i."id", i."schoolId", i."studentId", i."amountCents", 'CASH', i."label", i."paidAt",
       (SELECT u."id" FROM "users" u WHERE u."schoolId" = i."schoolId" ORDER BY u."role", u."createdAt" LIMIT 1),
       i."receiptHash",
       jsonb_build_array(jsonb_build_object('invoiceId', i."id", 'amountCents', i."amountCents"))
FROM "invoices" i
WHERE i."status" = 'PAID' AND i."receiptHash" IS NOT NULL AND i."paidAt" IS NOT NULL;

-- DropIndex / DropColumn
DROP INDEX "invoices_receiptHash_key";
ALTER TABLE "invoices" DROP COLUMN "receiptHash";

-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptHash_key" ON "payments"("receiptHash");
CREATE INDEX "payments_schoolId_paidAt_idx" ON "payments"("schoolId", "paidAt");
CREATE INDEX "payments_studentId_idx" ON "payments"("studentId");
CREATE UNIQUE INDEX "invoices_studentId_period_key" ON "invoices"("studentId", "period");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
