const ApiError = require('../utils/apiError');

/**
 * Restricts a route to the given roles.
 * Usage: router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
}

// Convenience groups
const isSuperAdmin = authorize('SUPER_ADMIN');
const isManager = authorize('SUPER_ADMIN', 'ADMIN');
const isAnyRole = authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'INTERN');

module.exports = { authorize, isSuperAdmin, isManager, isAnyRole };
