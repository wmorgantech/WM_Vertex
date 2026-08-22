const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const prisma = require('../config/db');

/**
 * Verifies the JWT access token and attaches the authenticated user to req.user.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Authentication token missing');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }
  if (user.status === 'TERMINATED' || user.status === 'SUSPENDED') {
    throw new ApiError(403, 'Account is not active');
  }

  req.user = user;
  next();
}

module.exports = authenticate;
