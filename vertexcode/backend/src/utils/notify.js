const prisma = require('../config/db');

// Small in-process cache of NotificationSetting rows, same pattern as the
// permission cache — settings change rarely, reload is cheap when they do.
let settingsCache = null;

async function loadCache() {
  const rows = await prisma.notificationSetting.findMany();
  settingsCache = new Map(rows.map((r) => [r.type, r.enabled]));
  return settingsCache;
}

function invalidateNotificationSettingsCache() {
  settingsCache = null;
}

async function isTypeEnabled(type) {
  const cache = settingsCache || (await loadCache());
  // A type with no row yet is enabled by default, so notifications work
  // out of the box before a Super Admin ever visits the settings page.
  return cache.has(type) ? cache.get(type) : true;
}

// Fires one notification. Never throws — a notification failure must not
// break the action that triggered it (task assignment, rejection, etc).
async function notify({ userId, type, title, message, link }) {
  if (!userId) return;
  try {
    if (!(await isTypeEnabled(type))) return;
    await prisma.notification.create({ data: { userId, type, title, message, link } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to create notification:', err.message);
  }
}

module.exports = { notify, invalidateNotificationSettingsCache };
