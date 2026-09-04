import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

// The attendance list/summary endpoints don't support server-side pagination
// (confirmed: GET /attendance and /attendance/me are unbounded findMany calls
// with no page/limit params) — rather than change that backend behavior,
// this paginates client-side over the already-loaded, already-fetched
// dataset using the same shared Pagination component every server-paginated
// page already uses (it only needs a {total, page, limit} meta object — it
// doesn't care whether that came from the API or was computed locally).
const PAGE_SIZE = 15;

export default function Attendance() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    const listCall = isManager ? api.get('/attendance') : api.get('/attendance/me');
    Promise.all([listCall, api.get('/attendance/summary')])
      .then(([r, s]) => { setRecords(r.data.data); setSummary(s.data.data); setPage(1); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const pagedRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginationMeta = { total: records.length, page, limit: PAGE_SIZE };

  const handleClock = async (type) => {
    setClocking(true);
    try {
      await api.post(`/attendance/${type}`);
      toast.success(type === 'clock-in' ? 'Clocked in' : 'Clocked out');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setClocking(false);
    }
  };

  const columns = [
    ...(isManager ? [{ key: 'user', header: 'Employee', render: (r) => `${r.user.firstName} ${r.user.lastName}` }] : []),
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'clockIn', header: 'Clock In', render: (r) => r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : '—' },
    { key: 'clockOut', header: 'Clock Out', render: (r) => r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : '—' },
    { key: 'workHours', header: 'Hours', render: (r) => r.workHours ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Clock-in/out, attendance history and reports"
        actions={(
          <>
            {user.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/attendance', 'attendance.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/attendance?format=xlsx', 'attendance.xlsx')}>Export Excel</button>
              </>
            )}
            {!isManager && (
              <>
                <button className="btn btn-primary" disabled={clocking} onClick={() => handleClock('clock-in')}>Clock In</button>
                <button className="btn btn-secondary" disabled={clocking} onClick={() => handleClock('clock-out')}>Clock Out</button>
              </>
            )}
          </>
        )}
      />

      {summary && (
        <div className="stat-grid">
          <StatCard label="Total Days Logged" value={summary.totalDays} accent="blue" />
          <StatCard label="Total Hours" value={`${summary.totalHours.toFixed(2)} hrs`} accent="green" />
          <StatCard label="Present" value={summary.PRESENT || 0} accent="green" />
          <StatCard label="Late" value={summary.LATE || 0} accent="amber" />
          <StatCard label="Absent" value={summary.ABSENT || 0} accent="red" />
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          <DataTable columns={columns} rows={pagedRecords} />
          <Pagination meta={paginationMeta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
