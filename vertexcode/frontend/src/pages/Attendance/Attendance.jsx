import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

export default function Attendance() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const load = () => {
    setLoading(true);
    // Server-side pagination — GET /attendance and /attendance/me both now
    // support page/limit (opt-in, so no other caller of these endpoints is
    // affected).
    const listCall = isManager
      ? api.get('/attendance', { params: { page, limit: pageSize } })
      : api.get('/attendance/me', { params: { page, limit: pageSize } });
    Promise.all([listCall, api.get('/attendance/summary')])
      .then(([r, s]) => { setRecords(r.data.data); setMeta(r.data.meta || null); setSummary(s.data.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { setPage(1); }, [pageSize]);
  useEffect(load, [page, pageSize]);

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
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/attendance', 'attendance.csv')}><Download size={16} strokeWidth={2.5} /> Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/attendance?format=xlsx', 'attendance.xlsx')}><Download size={16} strokeWidth={2.5} /> Export Excel</button>
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
          <DataTable columns={columns} rows={records} />
          <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={PAGE_SIZE_OPTIONS} />
        </>
      )}
    </div>
  );
}
