-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "position" TEXT;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_position_fkey" FOREIGN KEY ("position") REFERENCES "Designation"("name") ON DELETE SET NULL ON UPDATE CASCADE;

