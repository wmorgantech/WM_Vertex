-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('WEBSITE', 'REFERRAL', 'PHONE', 'EMAIL', 'WALK_IN', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CONVERTED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "companyName" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "source" "EnquirySource" NOT NULL DEFAULT 'WEBSITE',
    "assignedEmployeeId" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "followUpDate" TIMESTAMP(3),
    "nextAction" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_assignedEmployeeId_idx" ON "Enquiry"("assignedEmployeeId");

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
