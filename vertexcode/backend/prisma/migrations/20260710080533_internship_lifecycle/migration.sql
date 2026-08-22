-- CreateEnum
CREATE TYPE "InternshipCategory" AS ENUM ('FREE_INTERNSHIP', 'JOT');

-- CreateEnum
CREATE TYPE "InternshipAuditAction" AS ENUM ('FINAL_APPROVED', 'OFFER_LETTER_GENERATED', 'OFFER_LETTER_DOWNLOADED', 'CERTIFICATE_GENERATED', 'CERTIFICATE_DOWNLOADED', 'CATEGORY_SET');

-- AlterTable
ALTER TABLE "InternEnrollment" ADD COLUMN     "category" "InternshipCategory",
ADD COLUMN     "finalApprovedAt" TIMESTAMP(3),
ADD COLUMN     "finalApprovedById" TEXT;

-- CreateTable
CREATE TABLE "OfferLetter" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionCertificate" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipAudit" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "action" "InternshipAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternshipAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferLetter_enrollmentId_key" ON "OfferLetter"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletionCertificate_enrollmentId_key" ON "CompletionCertificate"("enrollmentId");

-- CreateIndex
CREATE INDEX "InternshipAudit_enrollmentId_idx" ON "InternshipAudit"("enrollmentId");

-- CreateIndex
CREATE INDEX "InternshipAudit_createdAt_idx" ON "InternshipAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "InternEnrollment" ADD CONSTRAINT "InternEnrollment_finalApprovedById_fkey" FOREIGN KEY ("finalApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InternEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionCertificate" ADD CONSTRAINT "CompletionCertificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InternEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionCertificate" ADD CONSTRAINT "CompletionCertificate_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipAudit" ADD CONSTRAINT "InternshipAudit_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InternEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipAudit" ADD CONSTRAINT "InternshipAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
