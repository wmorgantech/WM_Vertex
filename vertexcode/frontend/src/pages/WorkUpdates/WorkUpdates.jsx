import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { localDateString } from '../../lib/utils';

export default function WorkUpdates() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({ date: localDateString(), summary: '', tasksCompleted: '', blockers: '', planForTomorrow: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/work-updates').then(({ data }) => setUpdates(data.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/work-updates', form);
      toast.success('Work update submitted');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit update');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/work-updates/${reviewTarget.id}/review`, { managerFeedback: feedback, status: 'REVIEWED' });
      toast.success('Feedback saved');
      setReviewTarget(null);
      setFeedback('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save feedback');
    }
  };

  const columns = [
    ...(isManager ? [{ key: 'user', header: 'Employee', render: (r) => `${r.user.firstName} ${r.user.lastName}` }] : []),
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'summary', header: 'Summary' },
    { key: 'blockers', header: 'Blockers', render: (r) => r.blockers || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    ...(isManager ? [{
      key: 'actions', header: 'Actions', render: (r) => (
        <button className="btn btn-sm btn-primary" onClick={() => { setReviewTarget(r); setFeedback(r.managerFeedback || ''); }}>Review</button>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Daily Work Updates"
        subtitle="End-of-day reports and manager feedback"
        actions={!isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Submit Update</button>}
      />
      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={updates} />}

      {showModal && (
        <Modal title="Submit Daily Update" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>Date<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Summary<textarea required value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
            <label>Tasks Completed<textarea value={form.tasksCompleted} onChange={(e) => setForm({ ...form, tasksCompleted: e.target.value })} /></label>
            <label>Blockers<textarea value={form.blockers} onChange={(e) => setForm({ ...form, blockers: e.target.value })} /></label>
            <label>Plan for Tomorrow<textarea value={form.planForTomorrow} onChange={(e) => setForm({ ...form, planForTomorrow: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Submit'}</button>
            </div>
          </form>
        </Modal>
      )}

      {reviewTarget && (
        <Modal title={`Review — ${reviewTarget.user.firstName} ${reviewTarget.user.lastName}`} onClose={() => setReviewTarget(null)}>
          <form className="form-grid" onSubmit={handleReview}>
            <p>{reviewTarget.summary}</p>
            <label>Manager Feedback<textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setReviewTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Feedback</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
