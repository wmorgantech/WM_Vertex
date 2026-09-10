const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// `scope` mirrors the Employees/Interns/Trainees Active/All/Trash
// convention, applied to the new deletedAt column (see schema.prisma —
// Department had no existing active/status field to reuse).
// - active (default): deletedAt is null
// - trash: deletedAt is set
// - all: no filter
function scopeWhere(scope) {
  if (scope === 'trash') return { deletedAt: { not: null } };
  if (scope === 'all') return {};
  return { deletedAt: null };
}

async function listDepartments(req, res) {
  const { scope, search } = req.query;
  const where = {
    ...scopeWhere(scope),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  const departments = await prisma.department.findMany({
    where,
    include: {
      head: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  });
  return sendSuccess(res, 200, departments);
}

// GET /api/departments/summary — real counts for the summary cards, always
// scoped to the full table regardless of the current list view/filter.
async function summary(req, res) {
  const [total, trash] = await Promise.all([
    prisma.department.count(),
    prisma.department.count({ where: { deletedAt: { not: null } } }),
  ]);
  return sendSuccess(res, 200, { total, active: total - trash, trash });
}

async function getDepartment(req, res) {
  const dept = await prisma.department.findUnique({
    where: { id: req.params.id },
    include: {
      head: { select: { id: true, firstName: true, lastName: true } },
      users: { select: { id: true, firstName: true, lastName: true, role: true, designation: true, status: true } },
    },
  });
  if (!dept) throw new ApiError(404, 'Department not found');
  return sendSuccess(res, 200, dept);
}

async function createDepartment(req, res) {
  const { name, description, headId } = req.body;
  if (!name) throw new ApiError(400, 'Department name is required');
  const dept = await prisma.department.create({ data: { name, description, headId: headId || null } });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'DEPARTMENT', entityId: dept.id, entityLabel: dept.name, after: dept });
  return sendSuccess(res, 201, dept);
}

async function updateDepartment(req, res) {
  const { name, description, headId } = req.body;
  const before = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Department not found');
  const dept = await prisma.department.update({
    where: { id: req.params.id },
    data: { name, description, headId: headId || null },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'DEPARTMENT', entityId: dept.id, entityLabel: dept.name, before, after: dept });
  return sendSuccess(res, 200, dept);
}

// DELETE /api/departments/:id — Super Admin only, soft delete. The existing
// in-use safety check is preserved unchanged: a department with members
// still assigned cannot be deleted (soft or otherwise) until they're
// reassigned — deleting it would otherwise silently orphan/break those
// users' departmentId references.
async function deleteDepartment(req, res) {
  const before = await prisma.department.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!before) throw new ApiError(404, 'Department not found');
  if (before.deletedAt) throw new ApiError(400, 'This department is already in Trash');
  if (before._count.users > 0) {
    throw new ApiError(400, `Cannot delete: ${before._count.users} user(s) still belong to this department. Reassign them first.`);
  }
  const dept = await prisma.department.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'DEPARTMENT', entityId: before.id, entityLabel: before.name, before, after: dept });
  return sendSuccess(res, 200, { message: 'Department moved to Trash' });
}

// POST /api/departments/:id/restore — Super Admin only (same gate as delete).
async function restoreDepartment(req, res) {
  const before = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Department not found');
  if (!before.deletedAt) throw new ApiError(400, 'This department is not in Trash');
  const dept = await prisma.department.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await recordAudit({ actorId: req.user.id, action: 'RESTORED', module: 'DEPARTMENT', entityId: before.id, entityLabel: before.name, before, after: dept });
  return sendSuccess(res, 200, dept);
}

// DELETE /api/departments/:id/permanent — Super Admin only, irreversible.
// Requires the department to already be in Trash (mirrors the same
// two-step safety pattern used by Employees/Interns/Trainees/Documents'
// permanent-delete endpoints) — never a direct hard-delete of an active
// department.
async function permanentlyDeleteDepartment(req, res) {
  const before = await prisma.department.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!before) throw new ApiError(404, 'Department not found');
  if (!before.deletedAt) throw new ApiError(400, 'This department is not in Trash — move it to Trash first');
  if (before._count.users > 0) {
    throw new ApiError(400, `Cannot permanently delete: ${before._count.users} user(s) still belong to this department.`);
  }
  await prisma.department.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'PERMANENTLY_DELETED', module: 'DEPARTMENT', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'Department permanently deleted' });
}

module.exports = { listDepartments, summary, getDepartment, createDepartment, updateDepartment, deleteDepartment, restoreDepartment, permanentlyDeleteDepartment };
