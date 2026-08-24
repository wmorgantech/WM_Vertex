-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomFieldEntityType" AS ENUM ('EMPLOYEE', 'INTERN', 'TRAINEE', 'COLLEGE', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTISELECT', 'CHECKBOX', 'TEXTAREA');

-- AlterEnum
ALTER TYPE "InternDocumentType" ADD VALUE 'PERMISSION_LETTER';

-- AlterTable: cast enum -> text in place so existing Task rows keep their
-- real type/priority/status instead of being reset to the column default
-- (a plain DROP+ADD COLUMN, which Prisma would otherwise generate here,
-- silently discards every existing value).
ALTER TABLE "Task" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "Task" ALTER COLUMN "type" SET DEFAULT 'DAILY';
ALTER TABLE "Task" ALTER COLUMN "priority" TYPE TEXT USING "priority"::TEXT;
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
ALTER TABLE "Task" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

ALTER TABLE "Timesheet" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Timesheet" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "TaskPriority";

-- DropEnum
DROP TYPE "TaskStatus";

-- DropEnum
DROP TYPE "TaskType";

-- DropEnum
DROP TYPE "TimesheetStatus";

-- CreateTable
CREATE TABLE "TaskType" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TaskPriority" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPriority_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TaskStatus" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStatus_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TimesheetStatus" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetStatus_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeCode" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "entityType" "CustomFieldEntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_entityType_name_key" ON "CustomFieldDefinition"("entityType", "name");

-- CreateIndex
CREATE INDEX "CustomFieldValue_entityId_idx" ON "CustomFieldValue"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_entityId_key" ON "CustomFieldValue"("fieldId", "entityId");

-- Task_status_idx and Timesheet_status_idx already exist (unchanged by the
-- ALTER COLUMN TYPE casts above), so they're intentionally not recreated here.

-- Seed the master rows with the exact codes the old enums used, BEFORE the
-- foreign keys below are added, so existing Task/Timesheet rows (real data,
-- not just seed data) satisfy the new constraints without being touched.
INSERT INTO "TaskType" (code, label, "sortOrder", "updatedAt") VALUES
  ('DAILY', 'Daily', 1, CURRENT_TIMESTAMP),
  ('PROJECT', 'Project-based', 2, CURRENT_TIMESTAMP);

INSERT INTO "TaskPriority" (code, label, "sortOrder", "updatedAt") VALUES
  ('LOW', 'Low', 1, CURRENT_TIMESTAMP),
  ('MEDIUM', 'Medium', 2, CURRENT_TIMESTAMP),
  ('HIGH', 'High', 3, CURRENT_TIMESTAMP),
  ('URGENT', 'Urgent', 4, CURRENT_TIMESTAMP);

INSERT INTO "TaskStatus" (code, label, "isFinal", "sortOrder", "updatedAt") VALUES
  ('TODO', 'To Do', false, 1, CURRENT_TIMESTAMP),
  ('IN_PROGRESS', 'In Progress', false, 2, CURRENT_TIMESTAMP),
  ('IN_REVIEW', 'In Review', false, 3, CURRENT_TIMESTAMP),
  ('DONE', 'Done', true, 4, CURRENT_TIMESTAMP),
  ('BLOCKED', 'Blocked', false, 5, CURRENT_TIMESTAMP);

INSERT INTO "TimesheetStatus" (code, label, "isFinal", "sortOrder", "updatedAt") VALUES
  ('PENDING', 'Pending', false, 1, CURRENT_TIMESTAMP),
  ('APPROVED', 'Approved', true, 2, CURRENT_TIMESTAMP),
  ('REJECTED', 'Rejected', true, 3, CURRENT_TIMESTAMP);

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeCode_fkey" FOREIGN KEY ("leaveTypeCode") REFERENCES "LeaveType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_type_fkey" FOREIGN KEY ("type") REFERENCES "TaskType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_priority_fkey" FOREIGN KEY ("priority") REFERENCES "TaskPriority"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_status_fkey" FOREIGN KEY ("status") REFERENCES "TaskStatus"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_status_fkey" FOREIGN KEY ("status") REFERENCES "TimesheetStatus"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
