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

async function listWorkUpdates(req, res) {
  const { userId, status, from, to, departmentId } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const where = {
    ...(userId && { userId }),
    ...(status && { status }),
    ...(!isManagerRole && !userId && { userId: req.user.id }),
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
