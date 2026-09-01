import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

const STATUSES = ['DISCUSSION', 'DRAFT', 'SENT', 'UNDER_REVIEW', 'APPROVED', 'SIGNED', 'ACTIVE', 'EXPIRED', 'RENEWED', 'CANCELLED'];

const emptyForm = {
  collegeId: '', contactPerson: '', mouType: '', purpose: '', startDate: '', endDate: '',
  assignedEmployeeId: '', status: 'DISCUSSION',
};

export default function MOUs() {
  const { user } = useAuth();
  const [mous, setMous] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/mous'), api.get('/colleges'), api.get('/users')])
      .then(([m, c, u]) => {
        setMous(m.data.data);
        setColleges(c.data.data);
        setStaffUsers(u.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/mous', { ...form, assignedEmployeeId: form.assignedEmployeeId || null });
      toast.success('MOU created');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create MOU');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m) => {
    setEditing(m);
    setEditForm({
      status: m.status,
      endDate: m.endDate ? m.endDate.slice(0, 10) : '',
      signedDate: m.signedDate ? m.signedDate.slice(0, 10) : '',
      renewalDate: m.renewalDate ? m.renewalDate.slice(0, 10) : '',
      remarks: m.remarks || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/mous/${editing.id}`, editForm);
      toast.success('MOU updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update MOU');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete this MOU${m.mouType ? ` (${m.mouType})` : ''}? This cannot be undone.`)) return;
    try {
      await api.delete(`/mous/${m.id}`);
      toast.success('MOU removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete MOU');
    }
  };

  const handleDocumentSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingDoc(true);
    try {
      const { data } = await api.post(`/mous/${editing.id}/document`, formData);
      toast.success('Document attached');
      setEditing((prev) => ({ ...prev, documentPath: data.data.documentPath, documentName: data.data.documentName }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to attach document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDocument = async () => {
    try {
      await downloadReport(`/mous/${editing.id}/document`, editing.documentName || 'mou-document');
    } catch (err) {
      toast.error('Failed to download document');
    }
  };

  const columns = [
    { key: 'mouType', header: 'Type', render: (r) => r.mouType || '—' },
    { key: 'college', header: 'College', render: (r) => r.college.name },
    { key: 'assignee', header: 'Assigned To', render: (r) => r.assignedEmployee ? `${r.assignedEmployee.firstName} ${r.assignedEmployee.lastName}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'expiry', header: 'Expiry', render: (r) => {
        if (!r.endDate) return '—';
        if (r.expired) return <span className="badge badge-red">EXPIRED</span>;
        if (r.expiringSoon) return <span className="badge badge-amber">MOU EXPIRING SOON ({r.daysToExpiry}d)</span>;
        return new Date(r.endDate).toLocaleDateString();
      },
    },
    {
      key: 'actions', header: '', render: (r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Update</button>
          {user.role === 'SUPER_ADMIN' && (
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(r)} aria-label="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="MOU Management"
        subtitle="Memorandums of understanding with partner colleges"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New MOU</button>}
      />

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={mous} emptyMessage="No MOUs recorded yet." />}

      {showModal && (
        <Modal title="New MOU" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>College
              <select required value={form.collegeId} onChange={(e) => setForm({ ...form, collegeId: e.target.value })}>
                <option value="">Select college...</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>MOU Type<input value={form.mouType} onChange={(e) => setForm({ ...form, mouType: e.target.value })} /></label>
            <label>Purpose<textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Start Date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Assigned Employee
              <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
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
        <Modal title={`Update — ${editing.mouType || 'MOU'}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>End Date<input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} /></label>
            <label>Signed Date<input type="date" value={editForm.signedDate} onChange={(e) => setEditForm({ ...editForm, signedDate: e.target.value })} /></label>
            <label>Renewal Date<input type="date" value={editForm.renewalDate} onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })} /></label>
            <label>Remarks<textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <h4>Signed Document</h4>
            <p>{editing.documentName || 'No document attached yet.'}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {editing.documentPath && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadDocument}>Download</button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" disabled={uploadingDoc} onClick={() => docInputRef.current?.click()}>
                {uploadingDoc ? 'Uploading...' : editing.documentPath ? 'Replace File' : 'Attach File'}
              </button>
              <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleDocumentSelected} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
