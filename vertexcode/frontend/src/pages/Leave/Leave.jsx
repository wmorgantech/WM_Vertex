import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

export default function Leave() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [myRequests, setMyRequests] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaveTypeCode: '', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const calls = [
      api.get('/leave', { params: { userId: user.id } }),
      api.get('/masters/leave-types'),
    ];
    if (isManager) calls.push(api.get('/leave'));
    Promise.all(calls).then(([mine, types, team]) => {
      setMyRequests(mine.data.data);
      setLeaveTypes(types.data.data.filter((t) => t.active));
      if (team) setTeamRequests(team.data.data.filter((r) => r.userId !== user.id));
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/leave', form);
      toast.success('Leave request submitted');
      setShowModal(false);
      setForm({ leaveTypeCode: '', startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await api.delete(`/leave/${id}`);
      toast.success('Leave request cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/leave/${id}/approve`);
      toast.success('Leave approved — attendance updated for those dates');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection (required):');
    if (!reason || !reason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    try {
      await api.patch(`/leave/${id}/reject`, { reason });
      toast.success('Leave rejected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  const myColumns = [
    { key: 'leaveType', header: 'Type', render: (r) => r.leaveType.label },
    { key: 'startDate', header: 'From', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', header: 'To', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'rejectionReason', header: 'Notes', render: (r) => r.rejectionReason || '—' },
    { key: 'actions', header: '', render: (r) => r.status === 'PENDING' && <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(r.id)}>Cancel</button> },
  ];

  const teamColumns = [
    { key: 'name', header: 'Employee', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'leaveType', header: 'Type', render: (r) => r.leaveType.label },
    { key: 'startDate', header: 'From', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', header: 'To', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions', header: '', render: (r) => r.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(r.id)}>Approve</button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleReject(r.id)}>Reject</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle="Request time off and track approvals"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Request Leave</button>}
      />

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          {isManager && (
            <>
              <h3 style={{ marginTop: 0 }}>Team Requests</h3>
              <DataTable columns={teamColumns} rows={teamRequests} emptyMessage="No team leave requests." />
              <h3>My Requests</h3>
            </>
          )}
          <DataTable columns={myColumns} rows={myRequests} emptyMessage="No leave requests yet." />
        </>
      )}

      {showModal && (
        <Modal title="Request Leave" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Leave Type
              <select required value={form.leaveTypeCode} onChange={(e) => setForm({ ...form, leaveTypeCode: e.target.value })}>
                <option value="">Select type...</option>
                {leaveTypes.map((t) => <option key={t.code} value={t.code}>{t.label}{!t.paid ? ' (Unpaid)' : ''}</option>)}
              </select>
            </label>
            <label>Start Date<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <label>Reason<textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
