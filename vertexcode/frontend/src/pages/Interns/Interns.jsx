import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

export default function Interns() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [tab, setTab] = useState('enrollments');
  const [enrollments, setEnrollments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ name: '', program: '', startDate: '', endDate: '', description: '' });
  const [enrollForm, setEnrollForm] = useState({ userId: '', batchId: '', mentorId: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    // Managers get the full user directory (for mentor assignment too);
    // anyone else who can add interns gets a minimal, scoped picker list.
    const usersCall = isManager ? api.get('/users') : api.get('/interns/enrollable-users');
    Promise.all([api.get('/interns/enrollments'), api.get('/interns/batches'), usersCall])
      .then(([e, b, u]) => {
        setEnrollments(e.data.data);
        setBatches(b.data.data);
        setUsers(u.data.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/interns/batches', batchForm);
      toast.success('Batch created');
      setShowBatchModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create batch');
    } finally {
      setSaving(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/interns/enrollments', enrollForm);
      toast.success('Intern enrolled');
      setShowEnrollModal(false);
      setEnrollForm({ userId: '', batchId: '', mentorId: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enroll intern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (enrollment) => {
    if (!window.confirm(`Remove ${enrollment.user.firstName} ${enrollment.user.lastName} as an intern? This deactivates their account (soft delete) — the record is kept for history.`)) return;
    try {
      await api.delete(`/interns/enrollments/${enrollment.id}`);
      toast.success('Intern removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove intern');
    }
  };

  const enrollmentColumns = [
    { key: 'name', header: 'Intern', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (r) => r.batch.name },
    { key: 'mentor', header: 'Mentor', render: (r) => r.mentor ? `${r.mentor.firstName} ${r.mentor.lastName}` : '—' },
    { key: 'progressPercent', header: 'Progress', render: (r) => `${r.progressPercent}%` },
    { key: 'performanceRating', header: 'Rating', render: (r) => r.performanceRating ?? '—' },
    { key: 'completionStatus', header: 'Status', render: (r) => <Badge value={r.completionStatus} /> },
    ...(isSuperAdmin ? [{
      key: 'actions', header: '',
      render: (r) => <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r)}>Remove</button>,
    }] : []),
  ];

  const batchColumns = [
    { key: 'name', header: 'Batch' },
    { key: 'program', header: 'Program' },
    { key: 'startDate', header: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', header: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'count', header: 'Interns', render: (r) => r._count?.enrollments ?? 0 },
  ];

  const potentialInterns = isManager
    ? users.filter((u) => !enrollments.some((e) => e.user.id === u.id))
    : users; // already excludes enrolled users server-side

  return (
    <div>
      <PageHeader
        title="Intern Management"
        subtitle="Internship batches, mentor assignment and progress tracking"
        actions={(
          <>
            {isSuperAdmin && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/interns', 'interns.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/interns?format=xlsx', 'interns.xlsx')}>Export Excel</button>
              </>
            )}
            {isManager && <button className="btn btn-secondary" onClick={() => setShowBatchModal(true)}>+ New Batch</button>}
            <button className="btn btn-primary" onClick={() => setShowEnrollModal(true)}>+ Enroll Intern</button>
          </>
        )}
      />

      <div className="tabs">
        <button className={`tab ${tab === 'enrollments' ? 'active' : ''}`} onClick={() => setTab('enrollments')}>Enrollments</button>
        {isManager && <button className={`tab ${tab === 'batches' ? 'active' : ''}`} onClick={() => setTab('batches')}>Batches</button>}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : (
        tab === 'enrollments'
          ? <DataTable columns={enrollmentColumns} rows={enrollments} />
          : <DataTable columns={batchColumns} rows={batches} />
      )}

      {showBatchModal && (
        <Modal title="New Internship Batch" onClose={() => setShowBatchModal(false)}>
          <form className="form-grid" onSubmit={handleCreateBatch}>
            <label>Name<input required value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} /></label>
            <label>Program<input required value={batchForm.program} onChange={(e) => setBatchForm({ ...batchForm, program: e.target.value })} /></label>
            <label>Start Date<input type="date" required value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} /></label>
            <label>Description<textarea value={batchForm.description} onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowBatchModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showEnrollModal && (
        <Modal title="Enroll Intern" onClose={() => setShowEnrollModal(false)}>
          <form className="form-grid" onSubmit={handleEnroll}>
            <label>Intern
              <select required value={enrollForm.userId} onChange={(e) => setEnrollForm({ ...enrollForm, userId: e.target.value })}>
                <option value="">Select user...</option>
                {potentialInterns.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Batch
              <select required value={enrollForm.batchId} onChange={(e) => setEnrollForm({ ...enrollForm, batchId: e.target.value })}>
                <option value="">Select batch...</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {isManager && (
              <label>Mentor
                <select value={enrollForm.mentorId} onChange={(e) => setEnrollForm({ ...enrollForm, mentorId: e.target.value })}>
                  <option value="">— None (defaults to you) —</option>
                  {users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </label>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowEnrollModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Enroll'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
