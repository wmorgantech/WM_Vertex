const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');

async function listTasks(req, res) {
  const { status, priority, type, projectId, assigneeId, unallocated, dueBefore, dueAfter } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(type && { type }),
    ...(projectId && { projectId }),
    ...(assigneeId && isManagerRole && { assigneeId }),
    ...(unallocated === 'true' && isManagerRole && { assigneeId: null }),
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
  if (!title) throw new ApiError(400, 'title is required');

  // A task with no assignee is valid — it surfaces as NOT ALLOCATED on
  // dashboards and lists rather than being rejected.
  const task = await prisma.task.create({
    data: {
      title,
      description,
      type: type || 'DAILY',
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      createdById: req.user.id,
    },
  });
  await recordAudit({
    actorId: req.user.id, action: 'CREATED', module: 'TASK', entityId: task.id, entityLabel: task.title, after: task,
  });
  if (task.assigneeId) {
    await notify({
      userId: task.assigneeId, type: 'TASK_ASSIGNED', title: 'New task assigned',
      message: task.title, link: '/tasks',
    });
  }
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
  // Managers may (re)assign or explicitly unassign (assigneeId: null -> NOT ALLOCATED).
  if (assigneeId !== undefined && ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    data.assigneeId = assigneeId || null;
  }
  // Reaching a final status (configurable — not just the literal "DONE")
  // always completes the task; hitting 100% progress without picking a
  // final status explicitly still defaults to "DONE" for backward compatibility.
  if (status) {
    const statusMaster = await prisma.taskStatus.findUnique({ where: { code: status } });
    if (statusMaster?.isFinal) {
      data.progress = 100;
      data.completedAt = new Date();
    }
  }
  if (progress === 100 && !data.completedAt) {
    data.status = data.status || 'DONE';
    data.completedAt = new Date();
  }

  const updated = await prisma.task.update({ where: { id: req.params.id }, data });
  const reassigned = 'assigneeId' in data && data.assigneeId !== task.assigneeId;
  const action = reassigned ? 'REASSIGNED' : 'UPDATED';
  await recordAudit({
    actorId: req.user.id, action, module: 'TASK', entityId: updated.id, entityLabel: updated.title, before: task, after: updated,
  });
  if (reassigned && updated.assigneeId) {
    await notify({
      userId: updated.assigneeId, type: 'TASK_ASSIGNED', title: 'Task assigned to you',
      message: updated.title, link: '/tasks',
    });
  }
  return sendSuccess(res, 200, updated);
}

async function deleteTask(req, res) {
  const before = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Task not found');
  await prisma.task.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'TASK', entityId: before.id, entityLabel: before.title, before });
  return sendSuccess(res, 200, { message: 'Task removed' });
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask };
