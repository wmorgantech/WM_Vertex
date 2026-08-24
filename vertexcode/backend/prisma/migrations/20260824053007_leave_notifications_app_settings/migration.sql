-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REJECTED';

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT,
    "companyAddress" TEXT,
    "companyLogoUrl" TEXT,
    "signatoryName" TEXT,
    "signatoryTitle" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

