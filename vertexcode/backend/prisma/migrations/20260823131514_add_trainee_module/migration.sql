-- CreateEnum
CREATE TYPE "TrainingProgramStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TopicProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'REVIEWED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TRAINEE';

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "technology" TEXT,
    "duration" TEXT,
    "totalSessions" INTEGER,
    "trainerId" TEXT NOT NULL,
    "mentorId" TEXT,
    "fee" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION,
    "finalFee" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TrainingProgramStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTopic" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "expectedDurationHours" DOUBLE PRECISION,
    "trainingMaterial" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "mentorId" TEXT,
    "completionStatus" "InternCompletionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "education" TEXT,
    "qualification" TEXT,
    "experienceYears" DOUBLE PRECISION,
    "trainingStartDate" TIMESTAMP(3),
    "trainingEndDate" TIMESTAMP(3),
    "totalFee" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION,
    "finalFee" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraineeEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeTopicProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "TopicProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assignmentStatus" "AssignmentStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "remarks" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraineeTopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "topicId" TEXT,
    "trainerId" TEXT NOT NULL,
    "mentorId" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "topicsCovered" TEXT,
    "topicsPending" TEXT,
    "trainingMaterial" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineePayment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMode" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraineePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingTopic_programId_idx" ON "TrainingTopic"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeEnrollment_userId_key" ON "TraineeEnrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeTopicProgress_enrollmentId_topicId_key" ON "TraineeTopicProgress"("enrollmentId", "topicId");

-- CreateIndex
CREATE INDEX "TrainingSession_programId_date_idx" ON "TrainingSession"("programId", "date");

-- CreateIndex
CREATE INDEX "TraineePayment_enrollmentId_idx" ON "TraineePayment"("enrollmentId");

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTopic" ADD CONSTRAINT "TrainingTopic_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeEnrollment" ADD CONSTRAINT "TraineeEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeEnrollment" ADD CONSTRAINT "TraineeEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeEnrollment" ADD CONSTRAINT "TraineeEnrollment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeTopicProgress" ADD CONSTRAINT "TraineeTopicProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TraineeEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeTopicProgress" ADD CONSTRAINT "TraineeTopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TrainingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TrainingTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineePayment" ADD CONSTRAINT "TraineePayment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TraineeEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineePayment" ADD CONSTRAINT "TraineePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

