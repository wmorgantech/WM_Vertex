-- AlterTable: TraineeEnrollment gets real FK college/department columns,
-- mirroring InternEnrollment's collegeId/collegeDepartmentId — same purpose:
-- HOD/STAFF college-scoped monitoring. Null until an admin explicitly links
-- a trainee's enrollment to a college.
ALTER TABLE "TraineeEnrollment" ADD COLUMN     "collegeId" TEXT;
ALTER TABLE "TraineeEnrollment" ADD COLUMN     "collegeDepartmentId" TEXT;

ALTER TABLE "TraineeEnrollment" ADD CONSTRAINT "TraineeEnrollment_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TraineeEnrollment" ADD CONSTRAINT "TraineeEnrollment_collegeDepartmentId_fkey" FOREIGN KEY ("collegeDepartmentId") REFERENCES "CollegeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
