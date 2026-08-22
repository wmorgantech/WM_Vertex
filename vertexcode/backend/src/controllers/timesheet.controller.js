const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

async function listTimesheets(req, res) {
  const { userId, status, projectId, from, to } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...(userId && { userId }),
    ...(status && { status }),
    ...(projectId && { projectId }),
    ...(!isManagerRole && !userId && { userId: req.user.id }),
    ...((from || to) && {
      date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
    }),
  };

  const timesheets = await prisma.timesheet.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
      approver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });
  return sendSuccess(res, 200, timesheets);
}

async function createTimesheet(req, res) {
  const { date, projectId, taskId, hoursLogged, description } = req.body;
  if (!date || hoursLogged === undefined) throw new ApiError(400, 'date and hoursLogged are required');
  if (hoursLogged <= 0 || hoursLogged > 24) throw new ApiError(400, 'hoursLogged must be between 0 and 24');

  const timesheet = await prisma.timesheet.create({
    data: {
      userId: req.user.id,
      date: new Date(date),
      projectId: projectId || null,
      taskId: taskId || null,
      hoursLogged,
      description,
      status: 'PENDING',
    },
  });
  return sendSuccess(res, 201, timesheet);
}

async function updateTimesheet(req, res) {
  const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id } });
  if (!ts) throw new ApiError(404, 'Timesheet not found');
  if (ts.userId !== req.user.id) throw new ApiError(403, 'Not authorized to edit this timesheet');
  if (ts.status !== 'PENDING') throw new ApiError(409, 'Only pending timesheets can be edited');

  const { hoursLogged, description, projectId, taskId, date } = req.body;
  const updated = await prisma.timesheet.update({
    where: { id: req.params.id },
    data: {
      ...(hoursLogged !== undefined && { hoursLogged }),
      ...(description !== undefined && { description }),
      ...(projectId !== undefined && { projectId }),
      ...(taskId !== undefined && { taskId }),
      ...(date && { date: new Date(date) }),
    },
  });
  return sendSuccess(res, 200, updated);
}

// PATCH /api/timesheets/:id/approve
async function approveTimesheet(req, res) {
  const updated = await prisma.timesheet.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approverId: req.user.id, approvedAt: new Date(), rejectionReason: null },
  });
  return sendSuccess(res, 200, updated);
}

// PATCH /api/timesheets/:id/reject
async function rejectTimesheet(req, res) {
  const { reason } = req.body;
  const updated = await prisma.timesheet.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', approverId: req.user.id, approvedAt: new Date(), rejectionReason: reason || null },
  });
  return sendSuccess(res, 200, updated);
}

async function deleteTimesheet(req, res) {
  const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id } });
  if (!ts) throw new ApiError(404, 'Timesheet not found');
  if (ts.userId !== req.user.id && !['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    throw new ApiError(403, 'Not authorized');
  }
  await prisma.timesheet.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Timesheet removed' });
}

module.exports = { listTimesheets, createTimesheet, updateTimesheet, approveTimesheet, rejectTimesheet, deleteTimesheet };
