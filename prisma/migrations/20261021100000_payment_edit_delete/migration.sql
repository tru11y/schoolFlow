-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CHEQUE';

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" UUID,
ADD COLUMN     "deleteReason" TEXT;
