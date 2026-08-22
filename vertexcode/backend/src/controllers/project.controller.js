const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

async function listProjects(req, res) {
  const { status, managerId } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
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
  return sendSuccess(res, 201, project);
}

async function updateProject(req, res) {
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

async function deleteProject(req, res) {
  await prisma.project.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Project removed' });
}

module.exports = {
  listProjects, getProject, createProject, updateProject, deleteProject, addMember, removeMember,
};
