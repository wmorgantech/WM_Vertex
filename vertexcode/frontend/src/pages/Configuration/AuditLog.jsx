import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';

const MODULES = [
  'TASK', 'USER', 'DEPARTMENT', 'ATTENDANCE', 'TIMESHEET', 'DESIGNATION', 'LOCATION', 'EMPLOYMENT_TYPE', 'PERMISSION',
  'TRAINING_PROGRAM', 'TRAINEE_ENROLLMENT', 'TRAINEE_PAYMENT',
];

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/audit-logs', { params: { module: moduleFilter || undefined } })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  }, [moduleFilter]);

  const columns = [
    { key: 'createdAt', header: 'When', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'actor', header: 'By', render: (r) => `${r.actor.firstName} ${r.actor.lastName}` },
    { key: 'action', header: 'Action', render: (r) => <Badge value={r.action} /> },
    { key: 'module', header: 'Module', render: (r) => r.module.replace(/_/g, ' ') },
    { key: 'entityLabel', header: 'Record', render: (r) => r.entityLabel || r.entityId },
  ];

  return (
    <div>
      <PageHeader title="Configuration — Audit Log" subtitle="Who changed what, and when. Not editable by anyone." />

      <div className="toolbar">
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="">All modules</option>
          {MODULES.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={rows} emptyMessage="No audited activity yet." />}
    </div>
  );
}
