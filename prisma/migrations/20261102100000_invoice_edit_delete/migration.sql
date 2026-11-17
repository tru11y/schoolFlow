-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN     "deletedById" UUID,
ADD COLUMN     "deleteReason" TEXT;
