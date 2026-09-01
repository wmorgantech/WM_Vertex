const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { buildCodeMasterCrud } = require('../utils/codeMasterCrud');

const taskTypeCrud = buildCodeMasterCrud({ model: 'taskType', auditModule: 'TASK_TYPE', countRelation: 'tasks' });
const taskPriorityCrud = buildCodeMasterCrud({ model: 'taskPriority', auditModule: 'TASK_PRIORITY', countRelation: 'tasks', extraFields: ['color'] });
const taskStatusCrud = buildCodeMasterCrud({ model: 'taskStatus', auditModule: 'TASK_STATUS', countRelation: 'tasks', extraFields: ['color', 'isFinal'] });
const timesheetStatusCrud = buildCodeMasterCrud({ model: 'timesheetStatus', auditModule: 'TIMESHEET_STATUS', countRelation: 'timesheets', extraFields: ['color', 'isFinal'] });
const leaveTypeCrud = buildCodeMasterCrud({ model: 'leaveType', auditModule: 'LEAVE_TYPE', countRelation: 'requests', extraFields: ['paid'] });
const expenseCategoryCrud = buildCodeMasterCrud({ model: 'expenseCategory', auditModule: 'EXPENSE_CATEGORY', countRelation: 'expenses' });

// --- Designations ----------------------------------------------------------

async function listDesignations(req, res) {
  const rows = await prisma.designation.findMany({
    include: { department: { select: { id: true, name: true } }, _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return sendSuccess(res, 200, rows);
}

async function createDesignation(req, res) {
  const { name, departmentId, sortOrder } = req.body;
  if (!name) throw new ApiError(400, 'Designation name is required');
  const row = await prisma.designation.create({
    data: { name, departmentId: departmentId || null, sortOrder: sortOrder ?? 0 },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'DESIGNATION', entityId: row.id, entityLabel: row.name, after: row });
  return sendSuccess(res, 201, row);
}

async function updateDesignation(req, res) {
  const { name, departmentId, active, sortOrder } = req.body;
  const before = await prisma.designation.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Designation not found');
  const row = await prisma.designation.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(departmentId !== undefined && { departmentId: departmentId || null }),
      ...(active !== undefined && { active }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'DESIGNATION', entityId: row.id, entityLabel: row.name, before, after: row });
  return sendSuccess(res, 200, row);
}

async function deleteDesignation(req, res) {
  const before = await prisma.designation.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true, timesheets: true } } },
  });
  if (!before) throw new ApiError(404, 'Designation not found');
  if (before._count.users > 0) {
    throw new ApiError(400, `Cannot delete: ${before._count.users} user(s) still use this designation. Reassign them first.`);
  }
  if (before._count.timesheets > 0) {
    throw new ApiError(400, `Cannot delete: ${before._count.timesheets} timesheet entr(y/ies) still reference this designation.`);
  }
  await prisma.designation.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'DESIGNATION', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'Designation removed' });
}

// --- Locations ---------------------------------------------------------------

async function listLocations(req, res) {
  const rows = await prisma.location.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return sendSuccess(res, 200, rows);
}

async function createLocation(req, res) {
  const { name, address, city, sortOrder } = req.body;
  if (!name) throw new ApiError(400, 'Location name is required');
  const row = await prisma.location.create({ data: { name, address, city, sortOrder: sortOrder ?? 0 } });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'LOCATION', entityId: row.id, entityLabel: row.name, after: row });
  return sendSuccess(res, 201, row);
}

async function updateLocation(req, res) {
  const { name, address, city, active, sortOrder } = req.body;
  const before = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Location not found');
  const row = await prisma.location.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(active !== undefined && { active }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'LOCATION', entityId: row.id, entityLabel: row.name, before, after: row });
  return sendSuccess(res, 200, row);
}

async function deleteLocation(req, res) {
  const before = await prisma.location.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!before) throw new ApiError(404, 'Location not found');
  if (before._count.users > 0) {
    throw new ApiError(400, `Cannot delete: ${before._count.users} user(s) still use this location. Reassign them first.`);
  }
  await prisma.location.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'LOCATION', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'Location removed' });
}

// --- Employment Types --------------------------------------------------------

async function listEmploymentTypes(req, res) {
  const rows = await prisma.employmentType.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return sendSuccess(res, 200, rows);
}

async function createEmploymentType(req, res) {
  const { code, label, sortOrder } = req.body;
  if (!code || !label) throw new ApiError(400, 'code and label are required');
  const row = await prisma.employmentType.create({ data: { code: code.toUpperCase().replace(/\s+/g, '_'), label, sortOrder: sortOrder ?? 0 } });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'EMPLOYMENT_TYPE', entityId: row.code, entityLabel: row.label, after: row });
  return sendSuccess(res, 201, row);
}

async function updateEmploymentType(req, res) {
  const { label, active, sortOrder } = req.body;
  const before = await prisma.employmentType.findUnique({ where: { code: req.params.code } });
  if (!before) throw new ApiError(404, 'Employment type not found');
  const row = await prisma.employmentType.update({
    where: { code: req.params.code },
    data: {
      ...(label !== undefined && { label }),
      ...(active !== undefined && { active }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'EMPLOYMENT_TYPE', entityId: row.code, entityLabel: row.label, before, after: row });
  return sendSuccess(res, 200, row);
}

async function deleteEmploymentType(req, res) {
  const before = await prisma.employmentType.findUnique({ where: { code: req.params.code }, include: { _count: { select: { users: true } } } });
  if (!before) throw new ApiError(404, 'Employment type not found');
  if (before._count.users > 0) {
    throw new ApiError(400, `Cannot delete: ${before._count.users} user(s) still use this employment type. Reassign them first.`);
  }
  await prisma.employmentType.delete({ where: { code: req.params.code } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'EMPLOYMENT_TYPE', entityId: before.code, entityLabel: before.label, before });
  return sendSuccess(res, 200, { message: 'Employment type removed' });
}

// --- College Types ------------------------------------------------------------

async function listCollegeTypes(req, res) {
  const rows = await prisma.collegeType.findMany({
    include: { _count: { select: { colleges: true } } },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return sendSuccess(res, 200, rows);
}

async function createCollegeType(req, res) {
  const { code, label, sortOrder } = req.body;
  if (!code || !label) throw new ApiError(400, 'code and label are required');
  const row = await prisma.collegeType.create({ data: { code: code.toUpperCase().replace(/\s+/g, '_'), label, sortOrder: sortOrder ?? 0 } });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'COLLEGE_TYPE', entityId: row.code, entityLabel: row.label, after: row });
  return sendSuccess(res, 201, row);
}

async function updateCollegeType(req, res) {
  const { label, active, sortOrder } = req.body;
  const before = await prisma.collegeType.findUnique({ where: { code: req.params.code } });
  if (!before) throw new ApiError(404, 'College type not found');
  const row = await prisma.collegeType.update({
    where: { code: req.params.code },
    data: {
      ...(label !== undefined && { label }),
      ...(active !== undefined && { active }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'COLLEGE_TYPE', entityId: row.code, entityLabel: row.label, before, after: row });
  return sendSuccess(res, 200, row);
}

async function deleteCollegeType(req, res) {
  const before = await prisma.collegeType.findUnique({ where: { code: req.params.code }, include: { _count: { select: { colleges: true } } } });
  if (!before) throw new ApiError(404, 'College type not found');
  if (before._count.colleges > 0) {
    throw new ApiError(400, `Cannot delete: ${before._count.colleges} college(s) still use this type. Reassign them first.`);
  }
  await prisma.collegeType.delete({ where: { code: req.params.code } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'COLLEGE_TYPE', entityId: before.code, entityLabel: before.label, before });
  return sendSuccess(res, 200, { message: 'College type removed' });
}

module.exports = {
  listDesignations, createDesignation, updateDesignation, deleteDesignation,
  listLocations, createLocation, updateLocation, deleteLocation,
  listEmploymentTypes, createEmploymentType, updateEmploymentType, deleteEmploymentType,
  listCollegeTypes, createCollegeType, updateCollegeType, deleteCollegeType,
  taskTypeCrud, taskPriorityCrud, taskStatusCrud, timesheetStatusCrud, leaveTypeCrud, expenseCategoryCrud,
};
