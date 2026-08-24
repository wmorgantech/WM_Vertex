-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('LEAD', 'CONTACTED', 'DISCUSSION', 'PROPOSED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FOLLOW_UP_REQUIRED');

-- CreateEnum
CREATE TYPE "MouStatus" AS ENUM ('DISCUSSION', 'DRAFT', 'SENT', 'UNDER_REVIEW', 'APPROVED', 'SIGNED', 'ACTIVE', 'EXPIRED', 'RENEWED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CollegeType" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollegeType_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "College" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeCode" TEXT,
    "university" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "website" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "coordinator" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollegeDepartment" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollegeDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "collegeDepartmentId" TEXT,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "contactEmail" TEXT,
    "topic" TEXT NOT NULL,
    "technology" TEXT,
    "proposedDate" TIMESTAMP(3),
    "confirmedDate" TIMESTAMP(3),
    "duration" TEXT,
    "expectedParticipants" INTEGER,
    "actualParticipants" INTEGER,
    "assignedEmployeeId" TEXT,
    "trainerId" TEXT,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'LEAD',
    "followUpDate" TIMESTAMP(3),
    "discussionNotes" TEXT,
    "nextAction" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MOU" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "collegeDepartmentId" TEXT,
    "contactPerson" TEXT,
    "mouType" TEXT,
    "purpose" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "MouStatus" NOT NULL DEFAULT 'DISCUSSION',
    "assignedEmployeeId" TEXT,
    "signedDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "documentPath" TEXT,
    "documentName" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MOU_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "College_name_key" ON "College"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeDepartment_collegeId_name_key" ON "CollegeDepartment"("collegeId", "name");

-- CreateIndex
CREATE INDEX "Workshop_collegeId_idx" ON "Workshop"("collegeId");

-- CreateIndex
CREATE INDEX "Workshop_status_idx" ON "Workshop"("status");

-- CreateIndex
CREATE INDEX "MOU_collegeId_idx" ON "MOU"("collegeId");

-- CreateIndex
CREATE INDEX "MOU_status_idx" ON "MOU"("status");

-- AddForeignKey
ALTER TABLE "College" ADD CONSTRAINT "College_typeCode_fkey" FOREIGN KEY ("typeCode") REFERENCES "CollegeType"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeDepartment" ADD CONSTRAINT "CollegeDepartment_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_collegeDepartmentId_fkey" FOREIGN KEY ("collegeDepartmentId") REFERENCES "CollegeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOU" ADD CONSTRAINT "MOU_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOU" ADD CONSTRAINT "MOU_collegeDepartmentId_fkey" FOREIGN KEY ("collegeDepartmentId") REFERENCES "CollegeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MOU" ADD CONSTRAINT "MOU_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

