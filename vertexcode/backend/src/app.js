require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes');
const swaggerSpec = require('./config/swagger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { rateLimitKey } = require('./utils/rateLimitKey');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// (See utils/rateLimitKey.js for why a custom keyGenerator is needed at all —
// the IIS reverse proxy in front of this API appends a ":<port>" suffix to
// X-Forwarded-For that trips express-rate-limit's default IP-shape check.)
//
// Keyed by client IP, which multiple staff can share behind the office's
// IIS reverse proxy/NAT (see rateLimitKey.js). 500 req/15min proved too low
// for that shared-IP reality: an Admin/Super Admin dashboard alone fires
// 4-6 parallel GETs per page (Interns, Employees, Analytics, ...), and
// several staff browsing concurrently from the same IP exhausted the
// budget well within legitimate use, producing 429s on ordinary reads
// (e.g. GET /interns/enrollments) that the frontend was then rendering as
// a silently empty list. Raised to give real multi-user/multi-tab traffic
// headroom while still bounding abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
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