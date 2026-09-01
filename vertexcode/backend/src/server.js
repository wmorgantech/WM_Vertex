const app = require('./app');
const prisma = require('./config/db');
const { closeBrowser, warmBrowser } = require('./services/pdf.service');
const { startScheduler } = require('./utils/scheduler');

const PORT = process.env.PORT || 5111;

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`VertexWM backend listening on port ${PORT}`);
});

// Overdue tasks, missing attendance, expiring MOUs, workshop follow-ups and
// stalled trainee progress are "state" rather than "events" — nothing calls
// an endpoint when a due date quietly passes, so this polls for it instead.
const schedulerHandle = startScheduler();

// Pre-warm the shared Puppeteer browser so the first offer-letter/certificate
// request doesn't pay the ~10s Chromium launch cost inline.
warmBrowser().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[pdf.service] Failed to pre-warm browser:', err.message);
});

async function shutdown() {
  clearInterval(schedulerHandle);
  server.close();
  await Promise.all([prisma.$disconnect(), closeBrowser()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Log-only safety net so an unexpected error surfaces in the PM2 error log
// instead of vanishing silently. Deliberately does not exit/restart the
// process — PM2 already owns restart behavior, and Node's default behavior
// for an uncaught exception (crash) is what we're specifically avoiding
// turning into a silent, untraceable event.
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason);
});
