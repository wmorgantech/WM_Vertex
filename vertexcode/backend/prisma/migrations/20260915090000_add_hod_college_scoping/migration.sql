-- AlterTable: User gets an authorization scope (which College/CollegeDepartment
-- a HOD/STAFF account may monitor). Null for every other role.
ALTER TABLE "User" ADD COLUMN     "collegeId" TEXT;
ALTER TABLE "User" ADD COLUMN     "collegeDepartmentId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_collegeDepartmentId_fkey" FOREIGN KEY ("collegeDepartmentId") REFERENCES "CollegeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: InternEnrollment gets real FK college/department columns,
-- additive alongside the existing free-text collegeName/collegeDepartment
-- (unchanged). Existing rows stay null until explicitly linked.
ALTER TABLE "InternEnrollment" ADD COLUMN     "collegeId" TEXT;
ALTER TABLE "InternEnrollment" ADD COLUMN     "collegeDepartmentId" TEXT;

ALTER TABLE "InternEnrollment" ADD CONSTRAINT "InternEnrollment_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternEnrollment" ADD CONSTRAINT "InternEnrollment_collegeDepartmentId_fkey" FOREIGN KEY ("collegeDepartmentId") REFERENCES "CollegeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
