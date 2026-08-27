import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
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
function MonthCalendar({ days, todayIso }) {
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
            const dotClass = !day.isWorkingDay && hours === 0
              ? ''
              : day.status === 'BELOW'
                ? (hours === 0 ? 'ts-dot-empty' : 'ts-dot-partial')
                : 'ts-dot-complete';
            return (
              <div
                className={`ts-month-cal-cell${day.date === todayIso ? ' ts-month-cal-today' : ''}${!day.isWorkingDay ? ' ts-month-cal-nonworking' : ''}`}
                key={di}
                title={day.nonWorkingReason || ''}
              >
                <span className="ts-month-cal-date">{parseIsoDate(day.date).getDate()}</span>
                <span className="ts-month-cal-hours">{hours > 0 ? `${hours}h` : '—'}</span>
                {dotClass && <span className={`ts-month-cal-dot ${dotClass}`} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function MonthlySummary({ userId, onViewWeek }) {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [monthSummary, setMonthSummary] = useState(null);
  const [weekRows, setWeekRows] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingWeek, setViewingWeek] = useState(null); // manager/TeamView fallback — see handleView
  const dateInputRef = useRef(null);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

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
    ]).then(([monthRes, ...weekRes]) => {
      setMonthSummary(monthRes.data.data);
      setWeekRows(weeks.map((w, i) => ({
        label: `Week ${i + 1}`,
        weekStart: w.weekStart,
        period: formatWeekRange(w.weekStart, 6),
        ...weekRes[i].data.data,
      })));
    }).finally(() => setLoading(false));
  }, [from, to, userId]);

  useEffect(() => {
    const id = userId || user.id;
    api.get(`/users/${id}`).then(({ data }) => setEmployeeInfo(data.data)).catch(() => {});
  }, [userId, user.id]);

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

  const columns = [
    { key: 'week', header: 'Week', render: (r) => r.label },
    { key: 'period', header: 'Period', render: (r) => r.period },
    { key: 'expected', header: 'Expected', align: 'right', render: (r) => `${r.expectedHours}h` },
    { key: 'actual', header: 'Actual', align: 'right', render: (r) => `${r.actualHours}h` },
    { key: 'difference', header: 'Difference', align: 'right', render: (r) => `${r.difference >= 0 ? '+' : ''}${r.difference}h` },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} label={TIMESHEET_STATUS_LABELS[r.status]} /> },
    {
      key: 'actions', header: '', align: 'actions', render: (r) => (
        <button className="btn btn-ghost btn-sm" onClick={() => handleView(r.weekStart)}>
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  // Supplementary view for monthly review: the same entries already fetched
  // per week, pivoted by (Position, Project) into a single month total per
  // assignment — purely a client-side regroup, no new API.
  const breakdownRows = useMemo(() => {
    const map = new Map();
    weekRows.forEach((wr) => {
      (wr.entries || []).forEach((e) => {
        const key = `${e.position || ''}::${e.projectId || ''}`;
        if (!map.has(key)) {
          map.set(key, { key, position: e.position || '—', projectName: e.project?.name || '—', total: 0 });
        }
        map.get(key).total += e.hoursLogged;
      });
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [weekRows]);

  const breakdownTotal = breakdownRows.reduce((s, r) => s + r.total, 0);
  const breakdownColumns = [
    { key: 'position', header: 'Position', render: (r) => r.position },
    { key: 'project', header: 'Project', render: (r) => r.projectName },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <strong>{r.total.toFixed(2)}h</strong> },
  ];

  return (
    <div>
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
          <button className="btn-today" onClick={() => setCursor(new Date())}>Today</button>
          <button className="btn btn-ghost btn-icon" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : monthSummary && (
        <>
          <SummaryCards items={[
            { label: 'Expected', value: `${monthSummary.expectedHours}h` },
            { label: 'Actual', value: `${monthSummary.actualHours}h` },
            {
              label: 'Difference',
              value: `${monthSummary.difference > 0 ? '+' : ''}${monthSummary.difference}h`,
              tone: monthSummary.difference > 0 ? 'positive' : monthSummary.difference < 0 ? 'negative' : 'neutral',
            },
            { label: 'Working Days', value: monthSummary.workingDays },
          ]} />

          <MonthCalendar days={monthSummary.days} todayIso={todayIso} />

          <p className="ts-section-label" style={{ marginTop: 24 }}>Weeks</p>
          <DataTable columns={columns} rows={weekRows} emptyMessage="No weeks in this month." />

          {breakdownRows.length > 0 && (
            <>
              <p className="ts-section-label" style={{ marginTop: 24 }}>Assignment Summary</p>
              <DataTable columns={breakdownColumns} rows={breakdownRows} emptyMessage="No entries this month." />
              <div className="ts-breakdown-total">
                <span>Total</span>
                <strong>{breakdownTotal.toFixed(2)}h</strong>
              </div>
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
    </div>
  );
}
