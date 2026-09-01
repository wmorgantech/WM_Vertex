import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import CustomFieldsSection from '../../components/common/CustomFieldsSection';
import toast from 'react-hot-toast';

const TOPIC_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
const ASSIGNMENT_STATUSES = ['NOT_SUBMITTED', 'SUBMITTED', 'REVIEWED'];

export default function TraineeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [enrollment, setEnrollment] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMode: '', reference: '', notes: '' });
  const [sessionForm, setSessionForm] = useState({ topicId: '', date: '', topicsCovered: '', topicsPending: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/trainees/enrollments/${id}`)
      .then(({ data }) => {
        setEnrollment(data.data);
        return api.get('/trainees/sessions', { params: { programId: data.data.programId } });
      })
      .then(({ data }) => setSessions(data.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const updateTopic = async (topicId, field, value) => {
    try {
      await api.patch(`/trainees/enrollments/${id}/topics/${topicId}`, { [field]: value });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update progress');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/trainees/enrollments/${id}/payments`, { ...paymentForm, amount: Number(paymentForm.amount) });
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', paymentMode: '', reference: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleLogSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/sessions', { ...sessionForm, programId: enrollment.programId, trainerId: user.id });
      toast.success('Session logged');
      setShowSessionModal(false);
      setSessionForm({ topicId: '', date: '', topicsCovered: '', topicsPending: '', remarks: '' });
      const { data } = await api.get('/trainees/sessions', { params: { programId: enrollment.programId } });
      setSessions(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log session');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!enrollment) return <div className="empty-state">Trainee not found.</div>;

  const { user: trainee, program, mentor, progress, payment, topicProgress } = enrollment;
  const progressByTopic = new Map(topicProgress.map((p) => [p.topicId, p]));

  return (
    <div>
      <PageHeader title={`${trainee.firstName} ${trainee.lastName}`} subtitle={program.name} />

      <div className="card-grid">
        <div className="card">
          <h3>Profile</h3>
          <dl className="detail-list">
            <dt>Email</dt><dd>{trainee.email}</dd>
            <dt>Phone</dt><dd>{trainee.phone || '—'}</dd>
            <dt>Education</dt><dd>{enrollment.education || '—'}</dd>
            <dt>Qualification</dt><dd>{enrollment.qualification || '—'}</dd>
            <dt>Experience</dt><dd>{enrollment.experienceYears != null ? `${enrollment.experienceYears} yrs` : '—'}</dd>
            <dt>Mentor</dt><dd>{mentor ? `${mentor.firstName} ${mentor.lastName}` : <span className="badge badge-red">MENTOR NOT ALLOCATED</span>}</dd>
            <dt>Status</dt><dd><Badge value={enrollment.completionStatus} /></dd>
          </dl>
        </div>

        <div className="card">
          <h3>Training Progress — {progress.completionPercent}%</h3>
          <dl className="detail-list">
            <dt>Topics Completed</dt><dd>{progress.completedTopics} / {progress.totalTopics}</dd>
            <dt>Topics Pending</dt><dd>{progress.pendingTopics > 0 ? <span className="badge badge-amber">TRAINING PENDING ({progress.pendingTopics})</span> : '0'}</dd>
            <dt>Current Topic</dt><dd>{progress.currentTopic?.topic || 'All topics complete'}</dd>
            <dt>Assignments Completed</dt><dd>{progress.assignmentsCompleted}</dd>
            <dt>Assignments Pending</dt><dd>{progress.assignmentsPending}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Payment</h3>
          <dl className="detail-list">
            <dt>Final Fee</dt><dd>₹{payment.finalFee.toLocaleString()}</dd>
            <dt>Paid</dt><dd>₹{payment.totalPaid.toLocaleString()}</dd>
            <dt>Balance</dt><dd>{payment.balance > 0 ? <span className="badge badge-red">₹{payment.balance.toLocaleString()} DUE</span> : <span className="badge badge-green">PAID IN FULL</span>}</dd>
          </dl>
          {isManager && <button className="btn btn-primary btn-sm" onClick={() => setShowPaymentModal(true)}><Plus size={14} /> Record Payment</button>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Curriculum Topics</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Topic</th><th>Status</th><th>Assignment</th></tr>
            </thead>
            <tbody>
              {program.topics.map((t) => {
                const p = progressByTopic.get(t.id);
                return (
                  <tr key={t.id}>
                    <td>{t.sequence}</td>
                    <td>{t.topic}</td>
                    <td>
                      {isManager ? (
                        <select value={p?.status || 'NOT_STARTED'} onChange={(e) => updateTopic(t.id, 'status', e.target.value)}>
                          {TOPIC_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      ) : <Badge value={p?.status || 'NOT_STARTED'} />}
                    </td>
                    <td>
                      {isManager ? (
                        <select value={p?.assignmentStatus || 'NOT_SUBMITTED'} onChange={(e) => updateTopic(t.id, 'assignmentStatus', e.target.value)}>
                          {ASSIGNMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      ) : <Badge value={p?.assignmentStatus || 'NOT_SUBMITTED'} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Session History</h3>
          {isManager && <button className="btn btn-secondary btn-sm" onClick={() => setShowSessionModal(true)}><Plus size={14} /> Log Session</button>}
        </div>
        {sessions.length === 0 ? <div className="empty-state">No sessions logged yet.</div> : (
          <ul className="simple-list">
            {sessions.map((s) => (
              <li key={s.id}>
                {new Date(s.date).toLocaleDateString()} — {s.topic?.topic || 'General'} — Covered: {s.topicsCovered || '—'}
                {s.topicsPending && ` · Pending: ${s.topicsPending}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <CustomFieldsSection entityType="TRAINEE" entityId={trainee.id} />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Payment History</h3>
        {enrollment.payments.length === 0 ? <div className="empty-state">No payments recorded yet.</div> : (
          <ul className="simple-list">
            {enrollment.payments.map((p) => (
              <li key={p.id}>{new Date(p.paymentDate).toLocaleDateString()} — ₹{p.amount.toLocaleString()} ({p.paymentMode || 'N/A'}) {p.reference ? `— Ref: ${p.reference}` : ''}</li>
            ))}
          </ul>
        )}
      </div>

      {showPaymentModal && (
        <Modal title="Record Payment" onClose={() => setShowPaymentModal(false)}>
          <form className="form-grid" onSubmit={handleAddPayment}>
            <label>Amount<input type="number" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></label>
            <label>Payment Mode<input value={paymentForm.paymentMode} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} /></label>
            <label>Reference<input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></label>
            <label>Notes<textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showSessionModal && (
        <Modal title="Log Training Session" onClose={() => setShowSessionModal(false)}>
          <form className="form-grid" onSubmit={handleLogSession}>
            <label>Date<input type="date" required value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} /></label>
            <label>Topic
              <select value={sessionForm.topicId} onChange={(e) => setSessionForm({ ...sessionForm, topicId: e.target.value })}>
                <option value="">— General —</option>
                {program.topics.map((t) => <option key={t.id} value={t.id}>{t.topic}</option>)}
              </select>
            </label>
            <label>Topics Covered<textarea value={sessionForm.topicsCovered} onChange={(e) => setSessionForm({ ...sessionForm, topicsCovered: e.target.value })} /></label>
            <label>Topics Pending<textarea value={sessionForm.topicsPending} onChange={(e) => setSessionForm({ ...sessionForm, topicsPending: e.target.value })} /></label>
            <label>Remarks<textarea value={sessionForm.remarks} onChange={(e) => setSessionForm({ ...sessionForm, remarks: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowSessionModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Log Session'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
