-- Additive, nullable column only — no data loss, fully backward compatible,
-- safe to run against the live database at any time (existing rows simply
-- get deletedAt = NULL, meaning "not in Trash"). Adds soft-delete/Trash
-- support for College, Workshop and MOU, mirroring the same pattern already
-- used for Department/InternDocument/Project/Task (see
-- 20260908120000_add_soft_delete_columns).

ALTER TABLE "College" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Workshop" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "MOU" ADD COLUMN "deletedAt" TIMESTAMP(3);
