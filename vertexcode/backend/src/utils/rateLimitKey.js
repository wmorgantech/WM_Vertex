const { isIP } = require('net');

// The IIS reverse proxy in front of this API forwards the client address via
// X-Forwarded-For with a ":<port>" suffix appended (e.g. "223.239.58.232:3702"),
// which is non-standard — a bare IP is expected. Express surfaces that value
// verbatim as req.ip, which fails express-rate-limit's built-in IP-shape
// check (ERR_ERL_INVALID_IP_ADDRESS) and crashes the request. Stripping the
// port here is also a correctness fix, not just a crash fix: the ephemeral
// port changes on every connection from the same client, so without this the
// default keyGenerator (request.ip as-is) would key every single request
// separately and rate limiting would never actually trigger.
// trust proxy is set to the safe numeric value `1` in app.js (not `true`),
// so this doesn't touch the two related safety checks the default
// keyGenerator also runs (ERR_ERL_PERMISSIVE_TRUST_PROXY /
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) — neither can fire under that setting
// regardless of which keyGenerator is used.
//
// Shared by every rate limiter in this app (the global apiLimiter in app.js
// and the login-specific limiter in middleware/loginRateLimiter.js) so they
// all key on the same normalized client IP.
function rateLimitKey(req) {
  const ip = req.ip;
  if (!ip) return 'unknown';
  if (isIP(ip)) return ip;
  const bracketedIpv6 = ip.match(/^\[(.+)]:\d+$/); // e.g. "[::1]:12345"
  if (bracketedIpv6 && isIP(bracketedIpv6[1])) return bracketedIpv6[1];
  const lastColon = ip.lastIndexOf(':'); // e.g. "223.239.58.232:3702"
  if (lastColon !== -1 && isIP(ip.slice(0, lastColon))) return ip.slice(0, lastColon);
  return 'unrecognized-ip';
}

module.exports = { rateLimitKey };
