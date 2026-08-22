-- CreateEnum
CREATE TYPE "InternDocumentType" AS ENUM ('BONAFIDE', 'COLLEGE_ID', 'RESUME', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "InternDocumentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "DocumentAuditAction" AS ENUM ('UPLOADED', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "InternEnrollment" ADD COLUMN     "branch" TEXT,
ADD COLUMN     "collegeDepartment" TEXT,
ADD COLUMN     "collegeEmail" TEXT,
ADD COLUMN     "collegeName" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "hodName" TEXT,
ADD COLUMN     "internshipEndDate" TIMESTAMP(3),
ADD COLUMN     "internshipStartDate" TIMESTAMP(3),
ADD COLUMN     "registerNumber" TEXT,
ADD COLUMN     "semester" INTEGER,
ADD COLUMN     "university" TEXT,
ADD COLUMN     "year" INTEGER;

-- CreateTable
CREATE TABLE "InternDocument" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "InternDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "InternDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "adminRemarks" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternDocumentAudit" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" "DocumentAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternDocumentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternDocument_enrollmentId_idx" ON "InternDocument"("enrollmentId");

-- CreateIndex
CREATE INDEX "InternDocument_status_idx" ON "InternDocument"("status");

-- CreateIndex
CREATE INDEX "InternDocumentAudit_documentId_idx" ON "InternDocumentAudit"("documentId");

-- AddForeignKey
ALTER TABLE "InternDocument" ADD CONSTRAINT "InternDocument_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InternEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternDocument" ADD CONSTRAINT "InternDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternDocumentAudit" ADD CONSTRAINT "InternDocumentAudit_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InternDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternDocumentAudit" ADD CONSTRAINT "InternDocumentAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
