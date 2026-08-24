import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

export default function Attendance() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);

  const load = () => {
    setLoading(true);
    const listCall = isManager ? api.get('/attendance') : api.get('/attendance/me');
    Promise.all([listCall, api.get('/attendance/summary')])
      .then(([r, s]) => { setRecords(r.data.data); setSummary(s.data.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

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
          <StatCard label="Total Hours" value={summary.totalHours} accent="green" />
          <StatCard label="Present" value={summary.PRESENT || 0} accent="green" />
          <StatCard label="Late" value={summary.LATE || 0} accent="amber" />
          <StatCard label="Absent" value={summary.ABSENT || 0} accent="red" />
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={records} />}
    </div>
  );
}
