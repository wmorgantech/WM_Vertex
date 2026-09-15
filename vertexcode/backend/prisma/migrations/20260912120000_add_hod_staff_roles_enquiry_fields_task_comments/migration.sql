-- AlterEnum: add HOD/STAFF role stub (no college-scoping logic yet)
ALTER TYPE "Role" ADD VALUE 'HOD';
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterTable: Enquiry capture fields (submitter type, college/department, course/program)
ALTER TABLE "Enquiry" ADD COLUMN     "submitterType" TEXT;
ALTER TABLE "Enquiry" ADD COLUMN     "collegeId" TEXT;
ALTER TABLE "Enquiry" ADD COLUMN     "collegeDepartmentId" TEXT;
ALTER TABLE "Enquiry" ADD COLUMN     "courseOrProgram" TEXT;

CREATE INDEX "Enquiry_collegeId_idx" ON "Enquiry"("collegeId");

ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_collegeDepartmentId_fkey" FOREIGN KEY ("collegeDepartmentId") REFERENCES "CollegeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: TaskComment (progress-update / comment log for My Tasks)
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
