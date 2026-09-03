const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

// UTC-anchored midnight for the given local calendar day — see
// attendance.controller.js's dayStart() for why plain setHours(0,0,0,0)
// silently shifts a day off against @db.Date columns in +UTC timezones.
const dayStart = (d = new Date()) => {
  const local = new Date(d);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
};
const WORK_UPDATE_STATUSES = ['SUBMITTED', 'REVIEWED', 'FLAGGED'];

async function listWorkUpdates(req, res) {
  const { userId, status, from, to, departmentId } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...(userId && { userId }),
    ...(status && { status }),
    // Non-managers are always pinned to their own records — this overrides
    // whatever `userId` they supplied (their own, someone else's, or
    // garbage), not merely filling in a default when the param is absent.
    // req.user.id is always a real, truthy id, so `userId !== req.user.id`
    // alone already covers "no userId was supplied" (undefined !== a real
    // id is true) as well as "a different id was supplied" — no separate
    // `!userId` check needed. Mirrors the equivalent, already-correct
    // pattern in enquiry.controller.js's listEnquiries.
    ...(!isManagerRole && userId !== req.user.id && { userId: req.user.id }),
    ...((from || to) && {
      date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
    }),
    ...(departmentId && { user: { departmentId } }),
  };

  const updates = await prisma.dailyWorkUpdate.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, departmentId: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });
  return sendSuccess(res, 200, updates);
}

async function submitWorkUpdate(req, res) {
  const { date, summary, tasksCompleted, blockers, planForTomorrow } = req.body;
  if (!summary) throw new ApiError(400, 'summary is required');
  const targetDate = dayStart(date || new Date());

  const update = await prisma.dailyWorkUpdate.upsert({
    where: { userId_date: { userId: req.user.id, date: targetDate } },
    update: { summary, tasksCompleted, blockers, planForTomorrow, status: 'SUBMITTED' },
    create: {
      userId: req.user.id,
      date: targetDate,
      summary,
      tasksCompleted,
      blockers,
      planForTomorrow,
    },
  });
  return sendSuccess(res, 201, update);
}

async function reviewWorkUpdate(req, res) {
  const { managerFeedback, status } = req.body;
  // A falsy status (absent/null/'') keeps the existing default-to-REVIEWED
  // behavior below untouched; only a truthy-but-invalid value is rejected.
  if (status && !WORK_UPDATE_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${WORK_UPDATE_STATUSES.join(', ')}`);
  }
  const update = await prisma.dailyWorkUpdate.update({
    where: { id: req.params.id },
    data: {
      managerFeedback,
      status: status || 'REVIEWED',
      reviewedById: req.user.id,
      reviewedAt: new Date(),
    },
  });
  return sendSuccess(res, 200, update);
}

module.exports = { listWorkUpdates, submitWorkUpdate, reviewWorkUpdate };
