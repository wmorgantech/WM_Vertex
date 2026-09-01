require('dotenv').config();
require('express-async-errors');

const { isIP } = require('net');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes');
const swaggerSpec = require('./config/swagger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// The IIS reverse proxy in front of this API forwards the client address via
// X-Forwarded-For with a ":<port>" suffix appended (e.g. "223.239.58.232:3702"),
// which is non-standard — a bare IP is expected. Express surfaces that value
// verbatim as req.ip, which fails express-rate-limit's built-in IP-shape
// check (ERR_ERL_INVALID_IP_ADDRESS) and crashes the request. Stripping the
// port here is also a correctness fix, not just a crash fix: the ephemeral
// port changes on every connection from the same client, so without this the
// default keyGenerator (request.ip as-is) would key every single request
// separately and rate limiting would never actually trigger.
// trust proxy is already set to the safe numeric value `1` above (not
// `true`), so this doesn't touch the two related safety checks the default
// keyGenerator also runs (ERR_ERL_PERMISSIVE_TRUST_PROXY /
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) — neither can fire under that setting
// regardless of which keyGenerator is used.
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
});

app.use('/api', apiLimiter);

app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'vertexwm-backend',
    time: new Date().toISOString()
  })
);

// Swagger UI's page ships an inline <script> to boot the interactive UI —
// the global helmet() CSP above (script-src 'self', no unsafe-inline) would
// silently block it. Override the CSP header for just this path rather than
// weakening it globally.
app.use('/api-docs', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https: http:;"
  );
  next();
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;