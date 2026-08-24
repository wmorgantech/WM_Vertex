const prisma = require('../config/db');

/**
 * Records an audit trail entry. Never throws — a logging failure must not
 * break the request that triggered it.
 */
async function recordAudit({ actorId, action, module, entityId, entityLabel, before, after }) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, module, entityId, entityLabel, before, after },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { recordAudit };
