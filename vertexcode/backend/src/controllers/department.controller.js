const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

async function listDepartments(req, res) {
  const departments = await prisma.department.findMany({
    include: {
      head: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  });
  return sendSuccess(res, 200, departments);
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

async function deleteDepartment(req, res) {
  const before = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Department not found');
  await prisma.department.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'DEPARTMENT', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'Department removed' });
}

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment };
