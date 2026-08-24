const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { invalidatePermissionCache } = require('../middleware/permission');

// Only ADMIN's permissions are configurable — SUPER_ADMIN always has
// complete, non-delegable control (see middleware/permission.js).
const CONFIGURABLE_ROLE = 'ADMIN';

async function listPermissions(req, res) {
  const rows = await prisma.permission.findMany({
    where: { role: CONFIGURABLE_ROLE },
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
  return sendSuccess(res, 200, rows);
}

// PUT /api/permissions — bulk upsert: [{ module, action, allowed }, ...]
async function updatePermissions(req, res) {
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) throw new ApiError(400, 'permissions must be an array');

  const before = await prisma.permission.findMany({ where: { role: CONFIGURABLE_ROLE } });

  await prisma.$transaction(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { role_module_action: { role: CONFIGURABLE_ROLE, module: p.module, action: p.action } },
        update: { allowed: !!p.allowed },
        create: { role: CONFIGURABLE_ROLE, module: p.module, action: p.action, allowed: !!p.allowed },
      })
    )
  );

  invalidatePermissionCache();

  const after = await prisma.permission.findMany({ where: { role: CONFIGURABLE_ROLE } });
  await recordAudit({
    actorId: req.user.id,
    action: 'UPDATED',
    module: 'PERMISSION',
    entityId: CONFIGURABLE_ROLE,
    entityLabel: 'Admin permission matrix',
    before,
    after,
  });

  return sendSuccess(res, 200, after);
}

module.exports = { listPermissions, updatePermissions };
