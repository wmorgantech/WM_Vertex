const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

async function listTasks(req, res) {
  const { status, priority, type, projectId, assigneeId, dueBefore, dueAfter } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(type && { type }),
    ...(projectId && { projectId }),
    ...(assigneeId && isManagerRole && { assigneeId }),
    ...(!isManagerRole && { assigneeId: req.user.id }),
    ...((dueBefore || dueAfter) && {
      dueDate: {
        ...(dueBefore && { lte: new Date(dueBefore) }),
        ...(dueAfter && { gte: new Date(dueAfter) }),
      },
    }),
  };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });
  return sendSuccess(res, 200, tasks);
}

async function getTask(req, res) {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      project: { include: { members: { select: { userId: true } } } },
      timesheets: true,
    },
  });
  if (!task) throw new ApiError(404, 'Task not found');

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const isOwner = req.user.id === task.assigneeId || req.user.id === task.createdById;
  const isProjectRelated = task.project && (
    task.project.managerId === req.user.id
    || task.project.members.some((m) => m.userId === req.user.id)
  );
  if (!isManagerRole && !isOwner && !isProjectRelated) {
    throw new ApiError(403, 'Not authorized to view this task');
  }

  return sendSuccess(res, 200, task);
}

async function createTask(req, res) {
  const { title, description, type, priority, dueDate, projectId, assigneeId } = req.body;
  if (!title || !assigneeId) throw new ApiError(400, 'title and assigneeId are required');

  const task = await prisma.task.create({
    data: {
      title,
      description,
      type: type || 'DAILY',
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      projectId: projectId || null,
      assigneeId,
      createdById: req.user.id,
    },
  });
  return sendSuccess(res, 201, task);
}

async function updateTask(req, res) {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) throw new ApiError(404, 'Task not found');

  const isOwnerOrManager = req.user.id === task.assigneeId || ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!isOwnerOrManager) throw new ApiError(403, 'Not authorized to update this task');

  const { title, description, priority, status, progress, dueDate, assigneeId, projectId } = req.body;
  const data = {
    ...(title && { title }),
    ...(description !== undefined && { description }),
    ...(priority && { priority }),
    ...(status && { status }),
    ...(progress !== undefined && { progress }),
    ...(dueDate && { dueDate: new Date(dueDate) }),
    ...(projectId !== undefined && { projectId }),
  };
  if (assigneeId && ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) data.assigneeId = assigneeId;
  if (status === 'DONE' || progress === 100) {
    data.status = 'DONE';
    data.progress = 100;
    data.completedAt = new Date();
  }

  const updated = await prisma.task.update({ where: { id: req.params.id }, data });
  return sendSuccess(res, 200, updated);
}

async function deleteTask(req, res) {
  await prisma.task.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Task removed' });
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask };
