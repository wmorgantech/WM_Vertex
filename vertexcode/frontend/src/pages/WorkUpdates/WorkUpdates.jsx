import { useEffect, useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import DetailField from '../../components/common/DetailField';
import toast from 'react-hot-toast';
import { localDateString } from '../../lib/utils';

export default function WorkUpdates() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [updates, setUpdates] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const emptyForm = { date: localDateString(), summary: '', tasksCompleted: '', blockers: '', planForTomorrow: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadAllUsers = async () => {
    const allUsers = [];
    let page = 1;
    let total = Infinity;
    while (allUsers.length < total) {
      const { data } = await api.get('/users', { params: { page, limit: 100 } });
      allUsers.push(...data.data);
      total = data.meta?.total ?? allUsers.length;
      if (!data.data.length) break;
      page += 1;
    }
    return allUsers;
  };

  const load = () => {
    setLoading(true);
    setError('');
    const params = {
      status: statusFilter || undefined,
      userId: employeeFilter || undefined,
      from: fromDate || undefined,
      to: toDate ? `${toDate}T23:59:59.999` : undefined,
    };
    Promise.allSettled([
      api.get('/work-updates', { params }),
      isManager ? loadAllUsers() : Promise.resolve([]),
    ]).then(([updatesResult, usersResult]) => {
      if (updatesResult.status === 'fulfilled') setUpdates(updatesResult.value.data.data);
      if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
      const failed = [updatesResult, usersResult].find((result) => result.status === 'rejected');
      if (failed) setError(failed.reason?.response?.data?.message || 'Unable to load work updates.');
    }).finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter, fromDate, toDate, employeeFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/work-updates', form);
      toast.success('Work update submitted');
      setShowModal(false);
      // Reset for next time — without this, reopening the modal to submit a
      // second update the same day pre-fills it with the previous update's
      // leftover text (each submission still creates its own correct DB
      // row either way, but the stale text made repeat submissions
      // confusing/easy to mistake for "nothing new happened").
      setForm(emptyForm);
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
    ...(isManager ? [{ key: 'user', header: 'Employee', render: (r) => <span className="work-update-nowrap">{r.user.firstName} {r.user.lastName}</span> }] : []),
    { key: 'date', header: 'Date', render: (r) => <span className="work-update-nowrap">{new Date(r.date).toLocaleDateString()}</span> },
    { key: 'summary', header: 'Summary', render: (r) => <span className="work-update-text" title={r.summary}>{r.summary}</span> },
    { key: 'blockers', header: 'Blockers', render: (r) => <span className="work-update-text" title={r.blockers || undefined}>{r.blockers || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <span className="work-update-nowrap"><Badge value={r.status} /></span> },
    ...(isManager ? [{
      key: 'actions', header: 'Actions', render: (r) => (
        <div className="work-update-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setViewing(r)} aria-label="View work update" title="View work update"><Eye size={14} /></button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setReviewTarget(r); setFeedback(r.managerFeedback || ''); }}>Review</button>
        </div>
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
      {isManager && (
        <div className="toolbar work-updates-toolbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="FLAGGED">Flagged</option>
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" title="From date" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" title="To date" />
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} aria-label="Filter by employee">
            <option value="">All employees</option>
            {users.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
          </select>
        </div>
      )}

      {error ? (
        <div className="empty-state">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Retry</button>
        </div>
      ) : loading ? <div className="page-loading">Loading...</div> : <DataTable tableClassName="work-updates-table" columns={columns} rows={updates} />}

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

      {viewing && (
        <Modal size="wide" title="Work Update Details" onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.status} />
              <span className="detail-field-value">{viewing.user.firstName} {viewing.user.lastName}</span>
            </div>
            <div className="detail-grid">
              <DetailField label="Date" value={new Date(viewing.date).toLocaleDateString()} />
              <DetailField label="Status" value={viewing.status} />
              <DetailField label="Reviewed By" value={viewing.reviewedBy ? `${viewing.reviewedBy.firstName} ${viewing.reviewedBy.lastName}` : null} />
              <DetailField label="Reviewed At" value={viewing.reviewedAt ? new Date(viewing.reviewedAt).toLocaleString() : null} />
              <DetailField full label="Summary" value={viewing.summary} />
              <DetailField full label="Tasks Completed" value={viewing.tasksCompleted} />
              <DetailField full label="Blockers" value={viewing.blockers} />
              <DetailField full label="Plan for Tomorrow" value={viewing.planForTomorrow} />
              <DetailField full label="Manager Feedback" value={viewing.managerFeedback} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
