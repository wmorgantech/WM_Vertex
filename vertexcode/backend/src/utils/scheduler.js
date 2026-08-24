const prisma = require('../config/db');
const { notify } = require('./notify');

// Roughly once-per-day-per-item throttle so the interval below can run every
// 30 minutes without re-notifying about the same overdue task/expiring MOU
// on every tick.
const DEDUPE_WINDOW_MS = 20 * 60 * 60 * 1000;

async function alreadyNotifiedRecently(userId, type, link) {
  const existing = await prisma.notification.findFirst({
    where: { userId, type, link, createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } },
  });
  return !!existing;
}

async function checkOverdueTasks() {
  const finalStatuses = await prisma.taskStatus.findMany({ where: { isFinal: true }, select: { code: true } });
  const finalCodes = finalStatuses.map((s) => s.code);
  const overdue = await prisma.task.findMany({
    where: { dueDate: { lt: new Date() }, status: { notIn: finalCodes.length ? finalCodes : ['DONE'] }, assigneeId: { not: null } },
    select: { id: true, title: true, assigneeId: true, dueDate: true },
  });
  for (const t of overdue) {
    const link = '/tasks';
    if (await alreadyNotifiedRecently(t.assigneeId, 'TASK_OVERDUE', link)) continue;
    await notify({ userId: t.assigneeId, type: 'TASK_OVERDUE', title: 'Task overdue', message: `"${t.title}" was due ${new Date(t.dueDate).toLocaleDateString()}`, link });
  }
}

async function checkMissingAttendance() {
  const now = new Date();
  if (now.getHours() < 11) return; // give people until late morning before nagging
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const users = await prisma.user.findMany({
    where: { role: { in: ['EMPLOYEE', 'ADMIN'] }, status: 'ACTIVE' },
    select: { id: true },
  });
  if (users.length === 0) return;
  const attendanceToday = await prisma.attendance.findMany({
    where: { date: todayUtc, userId: { in: users.map((u) => u.id) }, clockIn: { not: null } },
    select: { userId: true },
  });
  const clockedInIds = new Set(attendanceToday.map((a) => a.userId));
  for (const u of users) {
    if (clockedInIds.has(u.id)) continue;
    const link = '/attendance';
    if (await alreadyNotifiedRecently(u.id, 'ATTENDANCE_MISSING', link)) continue;
    await notify({ userId: u.id, type: 'ATTENDANCE_MISSING', title: 'Attendance not recorded today', message: "You haven't clocked in yet today.", link });
  }
}

async function checkMouExpiring() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const mous = await prisma.mOU.findMany({
    where: { status: 'ACTIVE', endDate: { gte: now, lte: in30 }, assignedEmployeeId: { not: null } },
    select: { mouType: true, assignedEmployeeId: true, endDate: true },
  });
  for (const m of mous) {
    const link = '/mous';
    if (await alreadyNotifiedRecently(m.assignedEmployeeId, 'MOU_EXPIRING', link)) continue;
    await notify({ userId: m.assignedEmployeeId, type: 'MOU_EXPIRING', title: 'MOU expiring soon', message: `${m.mouType || 'MOU'} expires ${new Date(m.endDate).toLocaleDateString()}`, link });
  }
}

async function checkWorkshopFollowUps() {
  const workshops = await prisma.workshop.findMany({
    where: { followUpDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, assignedEmployeeId: { not: null } },
    select: { topic: true, assignedEmployeeId: true },
  });
  for (const w of workshops) {
    const link = '/workshops';
    if (await alreadyNotifiedRecently(w.assignedEmployeeId, 'WORKSHOP_FOLLOWUP_DUE', link)) continue;
    await notify({ userId: w.assignedEmployeeId, type: 'WORKSHOP_FOLLOWUP_DUE', title: 'Workshop follow-up overdue', message: w.topic, link });
  }
}

async function checkTraineePendingTopics() {
  const enrollments = await prisma.traineeEnrollment.findMany({
    where: { completionStatus: 'IN_PROGRESS', progressPercent: { lt: 100 } },
    select: { userId: true, progressPercent: true },
  });
  for (const e of enrollments) {
    const link = '/dashboard';
    if (await alreadyNotifiedRecently(e.userId, 'TRAINING_TOPIC_PENDING', link)) continue;
    await notify({ userId: e.userId, type: 'TRAINING_TOPIC_PENDING', title: 'Training topics pending', message: `You're at ${e.progressPercent}% completion — keep going.`, link });
  }
}

async function runScheduledChecks() {
  try {
    await Promise.all([
      checkOverdueTasks(),
      checkMissingAttendance(),
      checkMouExpiring(),
      checkWorkshopFollowUps(),
      checkTraineePendingTopics(),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Scheduled notification check failed:', err.message);
  }
}

function startScheduler(intervalMs = 30 * 60 * 1000) {
  runScheduledChecks();
  return setInterval(runScheduledChecks, intervalMs);
}

module.exports = { runScheduledChecks, startScheduler };
