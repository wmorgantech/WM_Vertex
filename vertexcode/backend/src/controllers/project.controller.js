const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// `scope` mirrors the Employees/Interns/Trainees Active/All/Trash
// convention, applied to the new deletedAt column (see schema.prisma).
// CANCELLED stays a purely legitimate business status here, independent of
// Trash — unlike Interns/Trainees, Project never needed to overload an
// existing status value, so there's no ambiguity to guard against.
function scopeWhere(scope) {
  if (scope === 'trash') return { deletedAt: { not: null } };
  if (scope === 'all') return {};
  return { deletedAt: null };
}

async function listProjects(req, res) {
  const { status, managerId, scope } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...scopeWhere(scope),
    ...(status && { status }),
    ...(managerId && { managerId }),
    ...(!isManagerRole && {
      OR: [{ managerId: req.user.id }, { members: { some: { userId: req.user.id } } }],
    }),
  };

  const projects = await prisma.project.findMany({
    where,
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
      members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, projects);
}

// GET /api/projects/summary — real counts for the summary cards, using the
// existing ProjectStatus enum values (no invented statuses).
async function summary(req, res) {
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const scopeFilter = isManagerRole ? {} : { OR: [{ managerId: req.user.id }, { members: { some: { userId: req.user.id } } }] };

  const [total, active, completed, trash] = await Promise.all([
    prisma.project.count({ where: { deletedAt: null, ...scopeFilter } }),
    prisma.project.count({ where: { deletedAt: null, status: 'ACTIVE', ...scopeFilter } }),
    prisma.project.count({ where: { deletedAt: null, status: 'COMPLETED', ...scopeFilter } }),
    prisma.project.count({ where: { deletedAt: { not: null }, ...scopeFilter } }),
  ]);
  return sendSuccess(res, 200, { total, active, completed, trash });
}

async function getProject(req, res) {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
      members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!project) throw new ApiError(404, 'Project not found');

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const isRelated = project.managerId === req.user.id
    || project.members.some((m) => m.userId === req.user.id);
  if (!isManagerRole && !isRelated) {
    throw new ApiError(403, 'Not authorized to view this project');
  }

  return sendSuccess(res, 200, project);
}

async function createProject(req, res) {
  const { name, description, status, startDate, endDate, managerId, memberIds = [] } = req.body;
  if (!name) throw new ApiError(400, 'Project name is required');

  const project = await prisma.project.create({
    data: {
      name,
      description,
      status: status || 'PLANNED',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      managerId: managerId || req.user.id,
      members: { create: memberIds.map((userId) => ({ userId })) },
    },
    include: { members: true },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'PROJECT', entityId: project.id, entityLabel: project.name, after: project });
  return sendSuccess(res, 201, project);
}

async function updateProject(req, res) {
  const before = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Project not found');

  const { name, description, status, startDate, endDate, managerId } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(managerId && { managerId }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'PROJECT', entityId: project.id, entityLabel: project.name, before, after: project });
  return sendSuccess(res, 200, project);
}

async function addMember(req, res) {
  const { userId } = req.body;
  if (!userId) throw new ApiError(400, 'userId is required');
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: req.params.id, userId } },
    update: {},
    create: { projectId: req.params.id, userId },
  });
  return sendSuccess(res, 201, member);
}

async function removeMember(req, res) {
  await prisma.projectMember.deleteMany({ where: { projectId: req.params.id, userId: req.params.userId } });
  return sendSuccess(res, 200, { message: 'Member removed' });
}

// DELETE /api/projects/:id — Super Admin only, soft delete. Previously a
// hard delete relying on the DB's FK constraint to reject removal of a
// project with existing Tasks/Timesheets (a raw P2003 error) — soft delete
// makes that unnecessary: Tasks/Timesheets keep pointing at the same row,
// which still exists, just hidden from the normal Active/All-by-default view.
async function deleteProject(req, res) {
  const before = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Project not found');
  if (before.deletedAt) throw new ApiError(400, 'This project is already in Trash');

  const project = await prisma.project.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'PROJECT', entityId: before.id, entityLabel: before.name, before, after: project });
  return sendSuccess(res, 200, { message: 'Project moved to Trash' });
}

// POST /api/projects/:id/restore — Super Admin only (same gate as delete).
async function restoreProject(req, res) {
  const before = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Project not found');
  if (!before.deletedAt) throw new ApiError(400, 'This project is not in Trash');

  const project = await prisma.project.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await recordAudit({ actorId: req.user.id, action: 'RESTORED', module: 'PROJECT', entityId: before.id, entityLabel: before.name, before, after: project });
  return sendSuccess(res, 200, project);
}

module.exports = {
  listProjects, summary, getProject, createProject, updateProject, deleteProject, restoreProject, addMember, removeMember,
};
