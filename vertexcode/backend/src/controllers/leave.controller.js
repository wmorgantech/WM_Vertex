const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');

function dateOnly(d) {
  const local = new Date(d);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

function daysInRange(start, end) {
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// GET /api/leave — mine, or everyone's for managers
async function listRequests(req, res) {
  const { userId, status } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const where = {
    ...(status && { status }),
    ...(isManagerRole ? (userId && { userId }) : { userId: req.user.id }),
  };
  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, departmentId: true } },
      leaveType: true,
      approver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, requests);
}

// POST /api/leave — self-service request
async function createRequest(req, res) {
  const { leaveTypeCode, startDate, endDate, reason } = req.body;
  if (!leaveTypeCode || !startDate || !endDate) {
    throw new ApiError(400, 'leaveTypeCode, startDate and endDate are required');
  }
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (end < start) throw new ApiError(400, 'End date cannot be before start date');

  const request = await prisma.leaveRequest.create({
    data: { userId: req.user.id, leaveTypeCode, startDate: start, endDate: end, reason },
    include: { user: { select: { managerId: true, firstName: true, lastName: true } }, leaveType: true },
  });

  if (request.user.managerId) {
    await notify({
      userId: request.user.managerId, type: 'LEAVE_REQUESTED', title: 'Leave request pending your review',
      message: `${request.user.firstName} ${request.user.lastName} requested ${request.leaveType.label} (${startDate} to ${endDate})`,
      link: '/leave',
    });
  }

  return sendSuccess(res, 201, request);
}

// DELETE /api/leave/:id — self-service cancel, only while still pending
async function cancelRequest(req, res) {
  const request = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw new ApiError(404, 'Leave request not found');
  if (request.userId !== req.user.id) throw new ApiError(403, 'You can only cancel your own leave requests');
  if (request.status !== 'PENDING') throw new ApiError(409, 'Only pending requests can be cancelled');

  const updated = await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  return sendSuccess(res, 200, updated);
}

// PATCH /api/leave/:id/approve — marks Attendance ON_LEAVE for the whole range
async function approveRequest(req, res) {
  const before = await prisma.leaveRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { firstName: true, lastName: true } }, leaveType: true },
  });
  if (!before) throw new ApiError(404, 'Leave request not found');
  if (before.status !== 'PENDING') throw new ApiError(409, 'Only pending requests can be approved');

  const updated = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approverId: req.user.id, approvedAt: new Date(), rejectionReason: null },
  });

  const days = daysInRange(before.startDate, before.endDate);
  await Promise.all(days.map((date) =>
    prisma.attendance.upsert({
      where: { userId_date: { userId: before.userId, date } },
      update: { status: 'ON_LEAVE', notes: `${before.leaveType.label} (approved)` },
      create: { userId: before.userId, date, status: 'ON_LEAVE', notes: `${before.leaveType.label} (approved)` },
    })
  ));

  await recordAudit({ actorId: req.user.id, action: 'APPROVED', module: 'LEAVE_REQUEST', entityId: updated.id, entityLabel: `${before.user.firstName} ${before.user.lastName}`, before, after: updated });
  await notify({
    userId: before.userId, type: 'LEAVE_APPROVED', title: 'Leave request approved',
    message: `${before.leaveType.label} approved`, link: '/leave',
  });

  return sendSuccess(res, 200, updated);
}

// PATCH /api/leave/:id/reject
async function rejectRequest(req, res) {
  const { reason } = req.body;
  if (!reason || !reason.trim()) throw new ApiError(400, 'A rejection reason is required');

  const before = await prisma.leaveRequest.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { firstName: true, lastName: true } }, leaveType: true },
  });
  if (!before) throw new ApiError(404, 'Leave request not found');
  if (before.status !== 'PENDING') throw new ApiError(409, 'Only pending requests can be rejected');

  const updated = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', approverId: req.user.id, approvedAt: new Date(), rejectionReason: reason },
  });

  await recordAudit({ actorId: req.user.id, action: 'REJECTED', module: 'LEAVE_REQUEST', entityId: updated.id, entityLabel: `${before.user.firstName} ${before.user.lastName}`, before, after: updated });
  await notify({
    userId: before.userId, type: 'LEAVE_REJECTED', title: 'Leave request rejected',
    message: reason, link: '/leave',
  });

  return sendSuccess(res, 200, updated);
}

module.exports = { listRequests, createRequest, cancelRequest, approveRequest, rejectRequest };
