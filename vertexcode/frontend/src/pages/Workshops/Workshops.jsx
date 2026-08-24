import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const STATUSES = ['LEAD', 'CONTACTED', 'DISCUSSION', 'PROPOSED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FOLLOW_UP_REQUIRED'];

const emptyForm = {
  collegeId: '', collegeDepartmentId: '', contactPerson: '', contactNumber: '', topic: '', technology: '',
  proposedDate: '', duration: '', expectedParticipants: '', assignedEmployeeId: '', trainerId: '',
};

export default function Workshops() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [workshops, setWorkshops] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    setLoading(true);
    const calls = [api.get('/workshops'), api.get('/colleges')];
    if (isManager) calls.push(api.get('/users'));
    Promise.all(calls)
      .then(([w, c, u]) => {
        setWorkshops(w.data.data);
        setColleges(c.data.data);
        if (u) setStaffUsers(u.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/workshops', {
        ...form,
        collegeDepartmentId: form.collegeDepartmentId || null,
        assignedEmployeeId: form.assignedEmployeeId || null,
        trainerId: form.trainerId || null,
        expectedParticipants: form.expectedParticipants === '' ? null : Number(form.expectedParticipants),
      });
      toast.success('Workshop created');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create workshop');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (w) => {
    setEditing(w);
    setEditForm({
      status: w.status, followUpDate: w.followUpDate ? w.followUpDate.slice(0, 10) : '',
      actualParticipants: w.actualParticipants ?? '', discussionNotes: w.discussionNotes || '',
      nextAction: w.nextAction || '', remarks: w.remarks || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/workshops/${editing.id}`, {
        ...editForm,
        actualParticipants: editForm.actualParticipants === '' ? null : Number(editForm.actualParticipants),
      });
      toast.success('Workshop updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update workshop');
    } finally {
      setSaving(false);
    }
  };

  const selectedCollege = colleges.find((c) => c.id === form.collegeId);

  const columns = [
    { key: 'topic', header: 'Topic' },
    { key: 'college', header: 'College', render: (r) => r.college.name },
    { key: 'department', header: 'Department', render: (r) => r.collegeDepartment?.name || '—' },
    { key: 'assignee', header: 'Assigned To', render: (r) => r.assignedEmployee ? `${r.assignedEmployee.firstName} ${r.assignedEmployee.lastName}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'followUp', header: 'Follow-up', render: (r) => r.followUpOverdue
        ? <span className="badge badge-red">FOLLOW-UP OVERDUE</span>
        : (r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : '—'),
    },
    {
      key: 'actions', header: '', render: (r) => (
        (isManager || r.assignedEmployee?.id === user.id) &&
        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Update</button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Workshop Management"
        subtitle="College workshop pipeline — from lead to completion"
        actions={isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Workshop</button>}
      />

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={workshops} emptyMessage="No workshops recorded yet." />}

      {showModal && (
        <Modal title="New Workshop" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>College
              <select required value={form.collegeId} onChange={(e) => setForm({ ...form, collegeId: e.target.value, collegeDepartmentId: '' })}>
                <option value="">Select college...</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {selectedCollege?.departments.length > 0 && (
              <label>Department
                <select value={form.collegeDepartmentId} onChange={(e) => setForm({ ...form, collegeDepartmentId: e.target.value })}>
                  <option value="">— None —</option>
                  {selectedCollege.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            )}
            <label>Topic<input required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></label>
            <label>Technology<input value={form.technology} onChange={(e) => setForm({ ...form, technology: e.target.value })} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Contact Number<input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></label>
            <label>Proposed Date<input type="date" value={form.proposedDate} onChange={(e) => setForm({ ...form, proposedDate: e.target.value })} /></label>
            <label>Duration<input placeholder="e.g. 1 day" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></label>
            <label>Expected Participants<input type="number" value={form.expectedParticipants} onChange={(e) => setForm({ ...form, expectedParticipants: e.target.value })} /></label>
            <label>Assigned Employee
              <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Trainer
              <select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Update — ${editing.topic}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Actual Participants<input type="number" value={editForm.actualParticipants} onChange={(e) => setEditForm({ ...editForm, actualParticipants: e.target.value })} /></label>
            <label>Follow-up Date<input type="date" value={editForm.followUpDate} onChange={(e) => setEditForm({ ...editForm, followUpDate: e.target.value })} /></label>
            <label>Next Action<input value={editForm.nextAction} onChange={(e) => setEditForm({ ...editForm, nextAction: e.target.value })} /></label>
            <label>Discussion Notes<textarea value={editForm.discussionNotes} onChange={(e) => setEditForm({ ...editForm, discussionNotes: e.target.value })} /></label>
            <label>Remarks<textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
