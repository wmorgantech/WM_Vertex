// Monday-Sunday work week helpers, shared by the weekly grid, the monthly
// view (which just widens the same date range) and the manager team view.
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Monday of the Mon-Sun week containing `date` — for a Sunday, that's 6 days
// earlier (the same week's Monday), not the start of the next one. Sunday
// itself stays a non-working day for expected-hours purposes (see
// timesheet.controller.js), it's just no longer excluded from the grid.
export function mondayOf(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i)); // Mon..Sun
}

// `endOffset` defaults to 5 (Saturday) so existing Mon-Sat callers (the
// manager Team view) are unaffected; the Mon-Sun Weekly grid passes 6.
//
// The same-month end date is built by hand rather than via
// toLocaleDateString({ day: 'numeric', year: 'numeric' }) — that combination
// (day+year, no month) renders as a garbled "2026 (day: 20)" on Node's ICU
// instead of "20, 2026", which is exactly the stray "day: NN" artifact the
// UI is required to avoid.
export function formatWeekRange(monday, endOffset = 5) {
  const weekEnd = addDays(monday, endOffset);
  const sameMonth = monday.getMonth() === weekEnd.getMonth();
  const startFmt = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFmt = sameMonth
    ? `${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

export function dayLabel(iso) {
  return DAY_LABELS[parseIsoDate(iso).getDay()];
}

export function monthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start, end };
}

export function monthLabel(year, monthIndex) {
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

// Backend rollup status -> UI label, shared by WeeklyGrid and
// MonthlySummary. Only SUBMITTED (== PENDING entries) gets a friendlier
// name; every other status renders as-is via Badge.
export const TIMESHEET_STATUS_LABELS = { SUBMITTED: 'Waiting for Approval' };

// 'SUPER_ADMIN' -> 'Super Admin' — used to render a system Role as a
// human label when an employee has no Designation set.
export function titleCase(value) {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
