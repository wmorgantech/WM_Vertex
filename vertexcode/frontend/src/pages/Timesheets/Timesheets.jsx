import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';
import { localDateString } from '../../lib/utils';

export default function Timesheets() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: localDateString(), projectId: '', hoursLogged: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/timesheets'), api.get('/projects')])
      .then(([t, p]) => { setTimesheets(t.data.data); setProjects(p.data.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/timesheets', { ...form, projectId: form.projectId || null, hoursLogged: parseFloat(form.hoursLogged) });
      toast.success('Timesheet submitted');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit timesheet');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/timesheets/${id}/approve`);
      toast.success('Timesheet approved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection (optional):') || '';
    try {
      await api.patch(`/timesheets/${id}/reject`, { reason });
      toast.success('Timesheet rejected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  const columns = [
    ...(isManager ? [{ key: 'user', header: 'Employee', render: (r) => `${r.user.firstName} ${r.user.lastName}` }] : []),
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'hoursLogged', header: 'Hours' },
    { key: 'description', header: 'Description' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    ...(isManager ? [{
      key: 'actions', header: 'Actions', render: (r) => r.status === 'PENDING' ? (
        <div className="row-actions">
          <button className="btn btn-sm btn-primary" onClick={() => handleApprove(r.id)}>Approve</button>
          <button className="btn btn-sm btn-ghost" onClick={() => handleReject(r.id)}>Reject</button>
        </div>
      ) : '—',
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Log hours per project/task and track approvals"
        actions={(
          <>
            {user.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/timesheets', 'timesheets.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/timesheets?format=xlsx', 'timesheets.xlsx')}>Export Excel</button>
              </>
            )}
            {!isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Log Time</button>}
          </>
        )}
      />
      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={timesheets} />}

      {showModal && (
        <Modal title="Log Time" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Date<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Project
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">— None —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Hours<input type="number" step="0.25" min="0.25" max="24" required value={form.hoursLogged} onChange={(e) => setForm({ ...form, hoursLogged: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Submit'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
