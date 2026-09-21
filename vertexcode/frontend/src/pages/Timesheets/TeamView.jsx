import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import WeeklyGrid from './WeeklyGrid';
import MonthlySummary from './MonthlySummary';
import { mondayOf, addDays, monthRange, monthLabel, formatWeekRange, toIsoDate, titleCase } from './weekUtils';

export default function TeamView() {
  const [period, setPeriod] = useState('weekly');
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [rows, setRows] = useState([]);
  const [memberRole, setMemberRole] = useState('ALL');
  const [memberId, setMemberId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  const range = period === 'weekly'
    ? { from: toIsoDate(monday), to: toIsoDate(addDays(monday, 5)), label: `Week of ${formatWeekRange(monday)}` }
    : (() => {
        const { start, end } = monthRange(monthCursor.getFullYear(), monthCursor.getMonth());
        return { from: toIsoDate(start), to: toIsoDate(end), label: monthLabel(monthCursor.getFullYear(), monthCursor.getMonth()) };
      })();

  const load = () => {
    setLoading(true);
    api.get('/timesheets/team-summary', { params: { from: range.from, to: range.to } })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [range.from, range.to]);

  const columns = [
    { key: 'user', header: 'Employee', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'expected', header: 'Expected', align: 'right', render: (r) => `${r.expectedHours}h` },
    { key: 'actual', header: 'Actual', align: 'right', render: (r) => `${r.actualHours}h` },
    { key: 'difference', header: 'Difference', align: 'right', render: (r) => `${r.difference >= 0 ? '+' : ''}${r.difference}h` },
    { key: 'below', header: 'Below Target', align: 'right', render: (r) => r.daysBelowTarget },
    { key: 'overtime', header: 'Overtime', align: 'right', render: (r) => `${r.overtimeHours}h` },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions', header: '', align: 'actions', render: (r) => (
        <button className="btn btn-ghost btn-sm" onClick={() => setViewing(r.user)}>
          <Eye size={14} /> View
        </button>
      ),
    },
  ];
  const filteredRows = rows.filter((row) => (
    (memberRole === 'ALL' || row.user.role === memberRole)
    && (memberId === 'ALL' || row.user.id === memberId)
    && (statusFilter === 'ALL' || row.status === statusFilter)
  ));
  const memberOptions = rows.filter((row) => memberRole === 'ALL' || row.user.role === memberRole);

  return (
    <div className="team-timesheet-view">
      <div className="team-timesheet-toolbar">
        <div className="ts-scope-tabs team-period-tabs" aria-label="Team timesheet period">
          <button className={`tab ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>Weekly</button>
          <button className={`tab ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>Monthly</button>
        </div>
        <div className="team-period-controls">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => (period === 'weekly' ? setMonday((m) => addDays(m, -7)) : setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1)))}
            aria-label="Previous period"
          >
            <ChevronLeft size={16} />
          </button>
          <strong style={{ fontSize: 14 }}>{range.label}</strong>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => (period === 'weekly' ? setMonday((m) => addDays(m, 7)) : setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1)))}
            aria-label="Next period"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="team-timesheet-filters">
        <label>Member type<select value={memberRole} onChange={(e) => { setMemberRole(e.target.value); setMemberId('ALL'); }}><option value="ALL">All members</option><option value="EMPLOYEE">Employees</option><option value="INTERN">Interns</option><option value="TRAINEE">Trainees</option></select></label>
        <label>Member<select value={memberId} onChange={(e) => setMemberId(e.target.value)}><option value="ALL">All members</option>{memberOptions.map((row) => <option key={row.user.id} value={row.user.id}>{row.user.firstName} {row.user.lastName}</option>)}</select></label>
        <label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : (
        <DataTable columns={columns} rows={filteredRows} emptyMessage="No team members match these filters." tableClassName="timesheet-team-table" />
      )}

      {viewing && (
        <Modal title={`${viewing.firstName} ${viewing.lastName} — ${range.label}`} onClose={() => setViewing(null)}>
          {period === 'weekly'
            ? <WeeklyGrid userId={viewing.id} readOnly onChanged={load} ownerRoleLabel={titleCase(viewing.role)} />
            : <MonthlySummary userId={viewing.id} />}
        </Modal>
      )}
    </div>
  );
}
