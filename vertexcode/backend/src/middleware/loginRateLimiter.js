const rateLimit = require('express-rate-limit');
const { rateLimitKey } = require('../utils/rateLimitKey');

// Stricter than the global apiLimiter (500 req/15min on all of /api) — login
// is a credential-guessing target, so it gets its own, much lower budget.
// Applied in addition to, not instead of, the global limiter (both run for
// every request to POST /auth/login).
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

module.exports = loginRateLimiter;
