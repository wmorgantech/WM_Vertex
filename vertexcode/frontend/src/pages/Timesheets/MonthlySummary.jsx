import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Eye, CheckCircle2, CalendarOff, UserCheck } from 'lucide-react';
import api from '../../api/axios';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import SummaryCards from './SummaryCards';
import WeeklyGrid from './WeeklyGrid';
import { useAuth } from '../../context/AuthContext';
import { monthRange, monthLabel, toIsoDate, parseIsoDate, mondayOf, addDays, formatWeekRange, titleCase, TIMESHEET_STATUS_LABELS } from './weekUtils';

// One Mon-Sun week per row, clipped to the calendar month's own days so the
// rows always sum to exactly the month totals above them (no double-count
// at a month boundary). Reuses the existing /timesheets/summary endpoint
// once per week — the same "compose several calls to one endpoint" pattern
// TeamView.jsx already uses per team member, rather than a new aggregate API.
function weeksInMonth(monthStart, monthEnd) {
  const weeks = [];
  let weekStart = mondayOf(monthStart);
  while (weekStart <= monthEnd) {
    const weekEnd = addDays(weekStart, 6);
    weeks.push({
      weekStart,
      rangeFrom: weekStart < monthStart ? monthStart : weekStart,
      rangeTo: weekEnd > monthEnd ? monthEnd : weekEnd,
    });
    weekStart = addDays(weekStart, 7);
  }
  return weeks;
}

// Calendar overview: the month's own `days` array (already returned by the
// month-range /timesheets/summary call — no extra fetch) laid out Mon-Sun,
// padded with blank leading/trailing cells so it reads as a real calendar
// grid. A status dot reuses the day's own classifyDay() status from the
// backend rather than recomputing anything client-side.
function MonthCalendar({ days, todayIso, leaveByDate, onSelectDay }) {
  const weeks = useMemo(() => {
    if (!days || days.length === 0) return [];
    const firstDow = parseIsoDate(days[0].date).getDay(); // 0=Sun..6=Sat
    const leadingBlanks = (firstDow + 6) % 7; // Mon-first offset
    const cells = [...Array(leadingBlanks).fill(null), ...days];
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    const last = rows[rows.length - 1];
    while (last && last.length < 7) last.push(null);
    return rows;
  }, [days]);

  if (weeks.length === 0) return null;

  return (
    <div className="ts-month-cal">
      <div className="ts-month-cal-head">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => <span key={d}>{d}</span>)}
      </div>
      {weeks.map((week, wi) => (
        <div className="ts-month-cal-row" key={wi}>
          {week.map((day, di) => {
            if (!day) return <div className="ts-month-cal-cell ts-month-cal-blank" key={di} />;
            const hours = Math.round(day.actualHours * 100) / 100;
            // ON_LEAVE is the authoritative, existing signal (Attendance,
            // written by leave.controller.js on approval) — the leave-type
            // label from leaveByDate is a nice-to-have overlay on top of it,
            // not a second source of truth for whether the day is leave.
            const onLeave = day.nonWorkingReason === 'ON_LEAVE';
            const leaveLabel = onLeave ? (leaveByDate?.get(day.date) || 'Leave') : null;
            const dotClass = onLeave
              ? 'ts-dot-leave'
              : !day.isWorkingDay && hours === 0
                ? ''
                : day.status === 'BELOW'
                  ? (hours === 0 ? 'ts-dot-empty' : 'ts-dot-partial')
                  : 'ts-dot-complete';
            return (
              <button
                type="button"
                className={`ts-month-cal-cell ts-month-cal-clickable${day.date === todayIso ? ' ts-month-cal-today' : ''}${!day.isWorkingDay ? ' ts-month-cal-nonworking' : ''}${onLeave ? ' ts-month-cal-leave' : ''}`}
                key={di}
                title={leaveLabel || day.nonWorkingReason || ''}
                onClick={() => onSelectDay(day.date)}
              >
                <span className="ts-month-cal-date">{parseIsoDate(day.date).getDate()}</span>
                {onLeave ? (
                  <span className="ts-leave-badge">{leaveLabel}</span>
                ) : (
                  <span className="ts-month-cal-hours">{hours > 0 ? `${hours}h` : '—'}</span>
                )}
                {dotClass && <span className={`ts-month-cal-dot ${dotClass}`} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function MonthlySummary({ userId, onViewWeek, calendarOnly = false }) {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [monthSummary, setMonthSummary] = useState(null);
  const [weekRows, setWeekRows] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingWeek, setViewingWeek] = useState(null); // manager/TeamView fallback — see handleView
  const [viewingDay, setViewingDay] = useState(null); // ISO date string — clicked calendar cell
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const dateInputRef = useRef(null);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
  }, [cursor]);

  const { start, end } = monthRange(cursor.getFullYear(), cursor.getMonth());
  const from = toIsoDate(start);
  const to = toIsoDate(end);

  useEffect(() => {
    setLoading(true);
    const weeks = weeksInMonth(start, end);
    Promise.all([
      api.get('/timesheets/summary', { params: { from, to, ...(userId && { userId }) } }),
      ...weeks.map((w) => api.get('/timesheets/summary', {
        params: { from: toIsoDate(w.rangeFrom), to: toIsoDate(w.rangeTo), ...(userId && { userId }) },
      })),
      // Same existing /attendance/summary endpoint Attendance.jsx itself
      // uses (already supports userId for a manager viewing someone else,
      // exactly like /timesheets/summary does) — powers the "Attendance" KPI.
      api.get('/attendance/summary', { params: { from, to, ...(userId && { userId }) } }),
    ]).then(([monthRes, ...rest]) => {
      const attendanceRes = rest.pop();
      setMonthSummary(monthRes.data.data);
      setWeekRows(weeks.map((w, i) => ({
        label: `Week ${i + 1}`,
        weekStart: w.weekStart,
        period: formatWeekRange(w.weekStart, 6),
        ...rest[i].data.data,
      })));
      setAttendanceSummary(attendanceRes.data.data);
    }).finally(() => setLoading(false));
  }, [from, to, userId]);

  useEffect(() => {
    const id = userId || user.id;
    api.get(`/users/${id}`).then(({ data }) => setEmployeeInfo(data.data)).catch(() => {});
  }, [userId, user.id]);

  // Reuses the existing Leave module's own API/data (GET /leave, the same
  // endpoint the Leave page itself uses) rather than a second leave source —
  // /timesheets/summary already flags which days are non-working because of
  // an ON_LEAVE Attendance record (leave.controller.js writes that on
  // approval), but it doesn't know *which* leave type caused it. This just
  // overlays that one extra detail. listRequests() has no date-range filter
  // server-side, so all of this user's approved requests are fetched once
  // (not re-fetched on month navigation) and the per-month figures below
  // are derived from it client-side — no new backend code.
  useEffect(() => {
    api.get('/leave', { params: { status: 'APPROVED', ...(userId && { userId }) } })
      .then(({ data }) => setLeaveRequests(data.data))
      .catch(() => setLeaveRequests([]));
  }, [userId]);

  // Same master-data endpoint Configuration → Master Data manages leave
  // types through — drives the Leave Summary's rows so it always matches
  // whatever leave types are actually configured, not a hardcoded list.
  useEffect(() => {
    api.get('/masters/leave-types').then(({ data }) => setLeaveTypes(data.data.filter((t) => t.active)));
  }, []);

  const leaveByDate = useMemo(() => {
    const map = new Map();
    for (const req of leaveRequests) {
      // Parse the Y-M-D straight off the ISO string rather than
      // `new Date(req.startDate)` + local getters — that combination
      // shifts a day in timezones behind UTC (the same class of bug fixed
      // earlier in setHours(0,0,0,0) callers).
      let cursorDate = parseIsoDate(req.startDate.slice(0, 10));
      const endDate = parseIsoDate(req.endDate.slice(0, 10));
      while (cursorDate <= endDate) {
        map.set(toIsoDate(cursorDate), req.leaveType?.label || 'Leave');
        cursorDate = addDays(cursorDate, 1);
      }
    }
    return map;
  }, [leaveRequests]);

  // Leave Summary's day counts per type, clipped to the currently-viewed
  // month only (a request can span outside it).
  const leaveTypeCounts = useMemo(() => {
    const counts = {};
    for (const req of leaveRequests) {
      const code = req.leaveType?.code;
      if (!code) continue;
      let cursorDate = parseIsoDate(req.startDate.slice(0, 10));
      const endDate = parseIsoDate(req.endDate.slice(0, 10));
      while (cursorDate <= endDate) {
        const iso = toIsoDate(cursorDate);
        if (iso >= from && iso <= to) counts[code] = (counts[code] || 0) + 1;
        cursorDate = addDays(cursorDate, 1);
      }
    }
    return counts;
  }, [leaveRequests, from, to]);

  // Self-service (Timesheets.jsx) jumps the Weekly tab to the chosen week via
  // onViewWeek. The manager/TeamView case renders MonthlySummary without
  // that prop (TeamView.jsx is unchanged), so it falls back to the same
  // read-only Modal+WeeklyGrid pattern TeamView already uses for its own
  // weekly "View" action.
  const handleView = (weekStart) => {
    if (onViewWeek) onViewWeek(weekStart);
    else setViewingWeek(weekStart);
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  // Entries for whichever calendar cell was clicked — the month summary's
  // `entries` array (already fetched) sliced down to just that one date.
  // No new API call.
  const dayEntries = useMemo(() => {
    if (!viewingDay || !monthSummary) return [];
    return (monthSummary.entries || []).filter((e) => e.date.slice(0, 10) === viewingDay);
  }, [viewingDay, monthSummary]);

  // Leave Days — the same authoritative ON_LEAVE signal the calendar's own
  // dots already use (an Attendance record written by leave.controller.js
  // on approval), just counted for the "monthly overview" KPI.
  const leaveDaysCount = monthSummary ? monthSummary.days.filter((d) => d.nonWorkingReason === 'ON_LEAVE').length : 0;

  // Attendance — Present+Late out of every Attendance record in the month
  // (same PRESENT+LATE-counts-as-attended convention already used for the
  // Trainee dashboard's own Attendance KPI).
  const presentDays = attendanceSummary ? (attendanceSummary.PRESENT || 0) + (attendanceSummary.LATE || 0) : 0;
  const attendanceValue = attendanceSummary && attendanceSummary.totalDays
    ? `${presentDays}/${attendanceSummary.totalDays}`
    : '—';

  return (
    <div className={`ts-monthly-view${calendarOnly ? ' ts-calendar-view' : ''}`}>
      <div className="ts-header-block">
        <div className="ts-header-row">
          <h2 className="ts-period-heading">{monthLabel(cursor.getFullYear(), cursor.getMonth())}</h2>
          {employeeInfo && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {employeeInfo.firstName} {employeeInfo.lastName}{employeeInfo.department ? ` · ${employeeInfo.department.name}` : ''}
            </span>
          )}
        </div>
        <div className="ts-nav-group">
          <button className="btn btn-ghost btn-icon" onClick={openDatePicker} aria-label="Pick a month">
            <Calendar size={15} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="ts-hidden-date-input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => { if (e.target.value) setCursor(parseIsoDate(e.target.value)); }}
          />
          <button className="btn btn-ghost btn-icon" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="btn-today" disabled={isCurrentMonth} onClick={() => setCursor(new Date())}>Today</button>
          <button className="btn btn-ghost btn-icon" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : monthSummary && (
        <>
          <SummaryCards items={[
            { label: 'Total Hours', value: `${monthSummary.actualHours}h`, icon: CheckCircle2, accent: 'blue' },
            { label: 'Working Days', value: monthSummary.workingDays, icon: Calendar, accent: 'purple' },
            { label: 'Leave Days', value: leaveDaysCount, icon: CalendarOff, accent: 'amber' },
            { label: 'Attendance', value: attendanceValue, icon: UserCheck, accent: 'green' },
          ]} />

          <MonthCalendar days={monthSummary.days} todayIso={todayIso} leaveByDate={leaveByDate} onSelectDay={setViewingDay} />
          <div className="ts-legend">
            <span><i className="ts-legend-dot ts-dot-complete" /> Worked</span>
            <span><i className="ts-legend-dot ts-legend-leave" /> Leave</span>
            <span><i className="ts-legend-dot ts-legend-weekend" /> Weekend</span>
          </div>

          {!calendarOnly && leaveTypes.length > 0 && (
            <>
              <p className="ts-section-label" style={{ marginTop: 24 }}>Leave Summary</p>
              <div className="ts-leave-summary">
                {leaveTypes.map((t) => (
                  <div className="ts-leave-summary-item" key={t.code}>
                    <span className="ts-leave-summary-label">{t.label}</span>
                    <span className="ts-leave-summary-value">{leaveTypeCounts[t.code] || 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!calendarOnly && (
            <>
              <p className="ts-section-label" style={{ marginTop: 24 }}>Weekly Status</p>
              {weekRows.length === 0 ? (
                <p className="empty-state" style={{ padding: 0, textAlign: 'left' }}>No weeks in this month.</p>
              ) : (
                <div className="ts-week-status-list">
                  {weekRows.map((w) => (
                    <div className="ts-week-status-row" key={toIsoDate(w.weekStart)}>
                      <span className="ts-week-status-period">{w.period}</span>
                      <Badge value={w.status} label={TIMESHEET_STATUS_LABELS[w.status]} />
                      <button className="btn btn-ghost btn-sm" onClick={() => handleView(w.weekStart)}>
                        <Eye size={14} /> View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {viewingWeek && (
        <Modal title={`Week of ${formatWeekRange(viewingWeek, 6)}`} onClose={() => setViewingWeek(null)}>
          <WeeklyGrid
            userId={userId}
            readOnly
            initialMonday={viewingWeek}
            ownerRoleLabel={employeeInfo?.designation || titleCase(employeeInfo?.role)}
          />
        </Modal>
      )}

      {viewingDay && (
        <Modal title={parseIsoDate(viewingDay).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setViewingDay(null)}>
          {dayEntries.length === 0 ? (
            <p className="empty-state" style={{ padding: 0, textAlign: 'left' }}>No entries logged on this date.</p>
          ) : (
            <ul className="ts-day-entry-list">
              {dayEntries.map((e) => (
                <li className="ts-day-entry-row" key={e.id}>
                  <p className="ts-day-entry-title">{e.position || 'Unassigned'}</p>
                  <div className="ts-day-entry-meta">
                    <span>{e.hoursLogged}h</span>
                    <Badge value={e.status} label={TIMESHEET_STATUS_LABELS[e.status]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
