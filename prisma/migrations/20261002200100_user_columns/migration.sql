-- AlterTable
ALTER TABLE "users" ADD COLUMN     "classLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "specialty" TEXT;

