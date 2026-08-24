const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

// In-process cache of the (role, module, action) -> allowed matrix. Small and
// rarely written, so a full reload on every mutation is simpler than
// per-key invalidation and still avoids a DB round trip on every request.
let cache = null;

async function loadCache() {
  const rows = await prisma.permission.findMany();
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.role}:${row.module}:${row.action}`, row.allowed);
  }
  cache = map;
  return cache;
}

function invalidatePermissionCache() {
  cache = null;
}

/**
 * Gates a route on a configurable (module, action) permission.
 * SUPER_ADMIN always passes — Super Admin has complete control and is
 * never subject to the configurable matrix. Every other role's access is
 * looked up from the Permission table, defaulting to denied when unset.
 * Usage: router.post('/', authenticate, can('department', 'create'), handler)
 */
function can(module, action) {
  return async (req, res, next) => {
    if (!req.user) throw new ApiError(401, 'Not authenticated');
    if (req.user.role === 'SUPER_ADMIN') return next();

    const map = cache || (await loadCache());
    const allowed = map.get(`${req.user.role}:${module}:${action}`) || false;
    if (!allowed) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { can, invalidatePermissionCache };
