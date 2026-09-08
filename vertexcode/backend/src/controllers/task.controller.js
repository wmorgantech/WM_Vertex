const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { parseCsvRecords } = require('../utils/csvParser');

// `scope` mirrors the Employees/Interns/Trainees/Departments/Projects
// Active/All/Trash convention, applied to the new deletedAt column (see
// schema.prisma) — `status` stays a purely independent, admin-configurable
// workflow value (TaskStatus master table), never overloaded for deletion.
function scopeWhere(scope) {
  if (scope === 'trash') return { deletedAt: { not: null } };
  if (scope === 'all') return {};
  return { deletedAt: null };
}

async function listTasks(req, res) {
  const { status, excludeStatus, priority, type, projectId, assigneeId, unallocated, dueBefore, dueAfter, search, scope, page, limit } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...scopeWhere(scope),
    ...(status && { status }),
    // Lets a caller ask for "everything except X" (e.g. hide completed by
    // default) without a dedicated boolean flag per status. Only applies
    // when `status` isn't already pinning an exact value.
    ...(!status && excludeStatus && { status: { not: excludeStatus } }),
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
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
  };

  // Pagination is opt-in — a request with no page/limit keeps returning the
  // full unbounded result set exactly as it does today (dashboards and
  // other existing callers rely on this).
  const paginate = page !== undefined || limit !== undefined;
  const take = paginate ? Math.min(parseInt(limit, 10) || 25, 100) : undefined;
  const skip = paginate ? (Math.max(parseInt(page, 10), 1) - 1) * take : undefined;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      ...(paginate && { take, skip }),
    }),
    paginate ? prisma.task.count({ where }) : Promise.resolve(undefined),
  ]);
  return sendSuccess(res, 200, tasks, paginate ? { total, page: Math.max(parseInt(page, 10), 1) || 1, limit: take, totalPages: Math.ceil(total / take) } : undefined);
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
      message: `${task.title} — assigned by ${req.user.firstName} ${req.user.lastName}`, link: '/tasks',
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
      message: `${updated.title} — assigned by ${req.user.firstName} ${req.user.lastName}`, link: '/tasks',
    });
  }
  return sendSuccess(res, 200, updated);
}

// DELETE /api/tasks/:id — Super Admin only, soft delete. Previously a hard
// delete; Timesheets reference tasks (Timesheet.taskId, no onDelete
// specified), so a hard delete of a task with existing timesheets would
// already fail with a raw FK error — soft delete removes that risk
// entirely since the row (and everything referencing it) is preserved.
async function deleteTask(req, res) {
  const before = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Task not found');
  if (before.deletedAt) throw new ApiError(400, 'This task is already in Trash');
  const task = await prisma.task.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'TASK', entityId: before.id, entityLabel: before.title, before, after: task });
  return sendSuccess(res, 200, { message: 'Task moved to Trash' });
}

// POST /api/tasks/:id/restore — Super Admin only (same gate as delete).
async function restoreTask(req, res) {
  const before = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Task not found');
  if (!before.deletedAt) throw new ApiError(400, 'This task is not in Trash');
  const task = await prisma.task.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await recordAudit({ actorId: req.user.id, action: 'RESTORED', module: 'TASK', entityId: before.id, entityLabel: before.title, before, after: task });
  return sendSuccess(res, 200, task);
}

// POST /api/tasks/import — bulk-create tasks from a CSV file. Same
// all-or-nothing validation pattern as user.controller.js's
// importEmployees: every row validated up front (title required; Project/
// Assignee resolved by name/email if given; Type/Priority/Status validated
// against their master tables); if any row fails, nothing is created.
// Expected header row: Title, Description, Type, Priority, Status, Project,
// Assignee Email, Due Date — mirrors GET /reports/tasks' export columns
// closely enough that an exported file is easy to adapt for re-import.
const IMPORT_MAX_ROWS = 500;

async function importTasks(req, res) {
  if (!req.file) throw new ApiError(400, 'CSV file is required (form field "file")');

  const text = req.file.buffer.toString('utf-8');
  const records = parseCsvRecords(text);
  if (records.length === 0) throw new ApiError(400, 'CSV file has no data rows');
  if (records.length > IMPORT_MAX_ROWS) {
    throw new ApiError(400, `CSV file has ${records.length} rows — the maximum per import is ${IMPORT_MAX_ROWS}`);
  }

  const [types, priorities, statuses, projects, users] = await Promise.all([
    prisma.taskType.findMany({ select: { code: true } }),
    prisma.taskPriority.findMany({ select: { code: true } }),
    prisma.taskStatus.findMany({ select: { code: true } }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, email: true } }),
  ]);
  const typeCodes = new Set(types.map((t) => t.code));
  const priorityCodes = new Set(priorities.map((p) => p.code));
  const statusCodes = new Set(statuses.map((s) => s.code));
  const projectByName = new Map(projects.map((p) => [p.name.toLowerCase(), p.id]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  const field = (record, name) => record[name] ?? record[name.replace(/ /g, '')] ?? '';
  const seenKeys = new Set();
  const errors = [];
  const toCreate = [];

  records.forEach((record, idx) => {
    const rowNum = idx + 2;
    const title = field(record, 'Title');
    const description = field(record, 'Description') || null;
    const type = field(record, 'Type') || 'DAILY';
    const priority = field(record, 'Priority') || 'MEDIUM';
    const status = field(record, 'Status') || 'TODO';
    const projectName = field(record, 'Project');
    const assigneeEmail = field(record, 'Assignee Email').toLowerCase();
    const dueDateRaw = field(record, 'Due Date');

    const rowErrors = [];
    if (!title) rowErrors.push('Title is required');
    if (!typeCodes.has(type)) rowErrors.push(`Unknown Type "${type}"`);
    if (!priorityCodes.has(priority)) rowErrors.push(`Unknown Priority "${priority}"`);
    if (!statusCodes.has(status)) rowErrors.push(`Unknown Status "${status}"`);

    let projectId = null;
    if (projectName) {
      projectId = projectByName.get(projectName.toLowerCase()) || null;
      if (!projectId) rowErrors.push(`Unknown project "${projectName}"`);
    }
    let assigneeId = null;
    if (assigneeEmail) {
      assigneeId = userByEmail.get(assigneeEmail) || null;
      if (!assigneeId) rowErrors.push(`Unknown assignee email "${assigneeEmail}"`);
    }
    let dueDate = null;
    if (dueDateRaw) {
      dueDate = new Date(dueDateRaw);
      if (Number.isNaN(dueDate.getTime())) rowErrors.push(`Invalid Due Date "${dueDateRaw}"`);
    }

    // A "duplicate" here means the same title assigned to the same person
    // with the same due date appearing more than once in this file — not a
    // DB uniqueness constraint (tasks have no natural unique key), just a
    // safeguard against accidentally importing the same row twice.
    const dedupeKey = `${title.toLowerCase()}|${assigneeId || ''}|${dueDateRaw}`;
    if (title && seenKeys.has(dedupeKey)) rowErrors.push('Duplicate row within this file (same Title, Assignee and Due Date)');
    seenKeys.add(dedupeKey);

    if (rowErrors.length) {
      errors.push({ row: rowNum, title: title || null, errors: rowErrors });
      return;
    }

    toCreate.push({ title, description, type, priority, status, projectId, assigneeId, dueDate });
  });

  if (errors.length) {
    throw new ApiError(400, `${errors.length} of ${records.length} row(s) failed validation — nothing was imported`, { errors });
  }

  const created = await prisma.$transaction(
    toCreate.map((r) => prisma.task.create({
      data: { ...r, createdById: req.user.id },
    }))
  );

  await recordAudit({
    actorId: req.user.id, action: 'IMPORTED', module: 'TASK', entityId: 'bulk',
    entityLabel: `${created.length} task(s) imported from CSV`, after: { count: created.length },
  });

  return sendSuccess(res, 201, { imported: created.length, message: `${created.length} task(s) imported.` });
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask, restoreTask, importTasks };
