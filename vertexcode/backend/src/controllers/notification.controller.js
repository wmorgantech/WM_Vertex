const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { invalidateNotificationSettingsCache } = require('../utils/notify');

const ALL_TYPES = [
  'TASK_ASSIGNED', 'TASK_OVERDUE', 'TASK_UNALLOCATED', 'TIMESHEET_PENDING', 'TIMESHEET_REJECTED',
  'ATTENDANCE_MISSING', 'TRAINING_SESSION_SCHEDULED', 'TRAINING_TOPIC_PENDING', 'INTERN_TASK_NOT_ALLOCATED',
  'PAYMENT_PENDING', 'MOU_EXPIRING', 'WORKSHOP_FOLLOWUP_DUE', 'CERTIFICATE_GENERATED', 'DOCUMENT_REVIEWED', 'GENERAL',
];

// GET /api/notifications — mine, most recent first
async function listMine(req, res) {
  const { unreadOnly, limit = 30 } = req.query;
  const rows = await prisma.notification.findMany({
    where: { userId: req.user.id, ...(unreadOnly === 'true' && { read: false }) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 30, 100),
  });
  return sendSuccess(res, 200, rows);
}

// GET /api/notifications/unread-count
async function unreadCount(req, res) {
  const count = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
  return sendSuccess(res, 200, { count });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const row = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!row || row.userId !== req.user.id) throw new ApiError(404, 'Notification not found');
  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  return sendSuccess(res, 200, updated);
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  return sendSuccess(res, 200, { message: 'All notifications marked read' });
}

// GET /api/notifications/settings — Super-Admin-configurable per-type toggle
async function listSettings(req, res) {
  const rows = await prisma.notificationSetting.findMany();
  const byType = new Map(rows.map((r) => [r.type, r.enabled]));
  return sendSuccess(res, 200, ALL_TYPES.map((type) => ({ type, enabled: byType.has(type) ? byType.get(type) : true })));
}

// PUT /api/notifications/settings — [{ type, enabled }, ...]
async function updateSettings(req, res) {
  const { settings } = req.body;
  if (!Array.isArray(settings)) throw new ApiError(400, 'settings must be an array');

  await prisma.$transaction(
    settings.map((s) =>
      prisma.notificationSetting.upsert({
        where: { type: s.type },
        update: { enabled: !!s.enabled },
        create: { type: s.type, enabled: !!s.enabled },
      })
    )
  );
  invalidateNotificationSettingsCache();

  const rows = await prisma.notificationSetting.findMany();
  return sendSuccess(res, 200, rows);
}

module.exports = { listMine, unreadCount, markRead, markAllRead, listSettings, updateSettings };
