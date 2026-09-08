-- Additive, nullable columns only — no data loss, fully backward compatible,
-- safe to run against the live database at any time (existing rows simply
-- get deletedAt = NULL, meaning "not in Trash"). Adds soft-delete support
-- for Departments, Intern Documents, Projects and Tasks, mirroring the
-- existing User.status-based soft delete already used for Employees/Interns/
-- Trainees (those reuse an existing column; these four models had none).
--
-- NOT applied automatically — see prisma/README or ask before running
-- `npx prisma migrate deploy` against production.

ALTER TABLE "Department" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "InternDocument" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "deletedAt" TIMESTAMP(3);
