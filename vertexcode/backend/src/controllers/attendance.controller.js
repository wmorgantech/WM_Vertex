const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// Builds a UTC-midnight Date for the given local calendar day. A plain
// `setHours(0,0,0,0)` anchors midnight in the *server's* local timezone,
// which for any positive UTC offset (e.g. IST, +5:30) serializes to the
// *previous* day once written to a `@db.Date` column — so "today" silently
// got stored as yesterday, and clock-in/out state read back wrong.
const dayStart = (d = new Date()) => {
  const local = new Date(d);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
};
const LATE_THRESHOLD_HOUR = 9; // 09:00 local
const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'];

function hoursBetween(a, b) {
  return Math.round(((b - a) / 3600000) * 100) / 100;
}

// POST /api/attendance/clock-in
async function clockIn(req, res) {
  const today = dayStart();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date: today } },
  });
  if (existing && existing.clockIn) throw new ApiError(409, 'Already clocked in today');

  const now = new Date();
  const isLate = now.getHours() >= LATE_THRESHOLD_HOUR + 1 || (now.getHours() === LATE_THRESHOLD_HOUR && now.getMinutes() > 15);

  const attendance = await prisma.attendance.upsert({
    where: { userId_date: { userId: req.user.id, date: today } },
    update: { clockIn: now, status: isLate ? 'LATE' : 'PRESENT' },
    create: { userId: req.user.id, date: today, clockIn: now, status: isLate ? 'LATE' : 'PRESENT' },
  });
  return sendSuccess(res, 200, attendance);
}

// POST /api/attendance/clock-out
async function clockOut(req, res) {
  const today = dayStart();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date: today } },
  });
  if (!existing || !existing.clockIn) throw new ApiError(400, 'You have not clocked in today');
  if (existing.clockOut) throw new ApiError(409, 'Already clocked out today');

  const now = new Date();
  const workHours = hoursBetween(existing.clockIn, now);

  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: { clockOut: now, workHours },
  });
  return sendSuccess(res, 200, attendance);
}

// GET /api/attendance/me
async function myAttendance(req, res) {
  const { from, to } = req.query;
  const attendance = await prisma.attendance.findMany({
    where: {
      userId: req.user.id,
      ...((from || to) && {
        date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
      }),
    },
    orderBy: { date: 'desc' },
  });
  return sendSuccess(res, 200, attendance);
}

// GET /api/attendance — team/org view (managers)
async function listAttendance(req, res) {
  const { userId, from, to, status, departmentId } = req.query;
  const attendance = await prisma.attendance.findMany({
    where: {
      ...(userId && { userId }),
      ...(status && { status }),
      ...((from || to) && {
        date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
      }),
      ...(departmentId && { user: { departmentId } }),
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, departmentId: true } } },
    orderBy: { date: 'desc' },
  });
  return sendSuccess(res, 200, attendance);
}

// POST /api/attendance/mark — manual entry/correction (managers), also handles ON_LEAVE/ABSENT/HOLIDAY
async function markAttendance(req, res) {
  const { userId, date, status, workHours, notes } = req.body;
  if (!userId || !date || !status) throw new ApiError(400, 'userId, date and status are required');
  if (!ATTENDANCE_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${ATTENDANCE_STATUSES.join(', ')}`);
  }

  // Date-only comparison via the same dayStart() convention used everywhere
  // else in this file — a raw `new Date(date) > new Date()` would also flag
  // "later today" as a false positive/negative depending on time-of-day.
  // An invalid `date` string produces an Invalid Date here, and `>` against
  // an Invalid Date is always false either way, so this check is a no-op
  // for that case and existing invalid-date handling below is unaffected.
  const targetDate = dayStart(date);
  if (targetDate > dayStart()) throw new ApiError(400, 'Cannot mark attendance for a future date');

  const before = await prisma.attendance.findUnique({ where: { userId_date: { userId, date: targetDate } } });
  const attendance = await prisma.attendance.upsert({
    where: { userId_date: { userId, date: targetDate } },
    update: { status, workHours, notes },
    create: { userId, date: targetDate, status, workHours, notes },
  });
  await recordAudit({
    actorId: req.user.id, action: before ? 'UPDATED' : 'CREATED', module: 'ATTENDANCE',
    entityId: attendance.id, entityLabel: `${userId} — ${targetDate.toISOString().slice(0, 10)}`, before, after: attendance,
  });
  return sendSuccess(res, 200, attendance);
}

// GET /api/attendance/summary — aggregate stats
async function summary(req, res) {
  const { userId, from, to } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const targetUserId = (userId && isManagerRole) ? userId : req.user.id;

  const records = await prisma.attendance.findMany({
    where: {
      userId: targetUserId,
      ...((from || to) && {
        date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
      }),
    },
  });

  const summaryData = records.reduce(
    (acc, r) => {
      acc.totalDays += 1;
      acc.totalHours += r.workHours || 0;
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { totalDays: 0, totalHours: 0 }
  );

  return sendSuccess(res, 200, summaryData);
}

module.exports = { clockIn, clockOut, myAttendance, listAttendance, markAttendance, summary };
