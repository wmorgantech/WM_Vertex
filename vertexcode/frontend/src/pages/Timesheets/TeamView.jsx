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

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>Weekly</button>
          <button className={`tab ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>Monthly</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {loading ? <div className="page-loading">Loading...</div> : (
        <DataTable columns={columns} rows={rows} emptyMessage="No team members found." />
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
