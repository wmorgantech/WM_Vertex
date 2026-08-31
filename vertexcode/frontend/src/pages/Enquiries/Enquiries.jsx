import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

const STATUSES = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CONVERTED', 'CLOSED', 'CANCELLED'];
const SOURCES = ['WEBSITE', 'REFERRAL', 'PHONE', 'EMAIL', 'WALK_IN', 'SOCIAL_MEDIA', 'OTHER'];

const emptyForm = {
  contactName: '', contactEmail: '', contactPhone: '', companyName: '', subject: '', description: '',
  source: 'WEBSITE', followUpDate: '', assignedEmployeeId: '',
};

export default function Enquiries() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [enquiries, setEnquiries] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    setLoading(true);
    const calls = [api.get('/enquiries', { params: { search: search || undefined, status: statusFilter || undefined, source: sourceFilter || undefined } })];
    if (isManager) calls.push(api.get('/users'));
    Promise.all(calls)
      .then(([e, u]) => {
        setEnquiries(e.data.data);
        if (u) setStaffUsers(u.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [search, statusFilter, sourceFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/enquiries', {
        ...form,
        followUpDate: form.followUpDate || null,
        assignedEmployeeId: form.assignedEmployeeId || null,
      });
      toast.success('Enquiry logged');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log enquiry');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (en) => {
    setEditing(en);
    setEditForm({
      status: en.status, followUpDate: en.followUpDate ? en.followUpDate.slice(0, 10) : '',
      nextAction: en.nextAction || '', remarks: en.remarks || '',
      assignedEmployeeId: en.assignedEmployee?.id || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/enquiries/${editing.id}`, {
        ...editForm,
        followUpDate: editForm.followUpDate || null,
        ...(isManager && { assignedEmployeeId: editForm.assignedEmployeeId || null }),
      });
      toast.success('Enquiry updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update enquiry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (en) => {
    if (!window.confirm(`Delete the enquiry "${en.subject}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/enquiries/${en.id}`);
      toast.success('Enquiry removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove enquiry');
    }
  };

  const columns = [
    { key: 'contactName', header: 'Contact' },
    { key: 'companyName', header: 'Company', render: (r) => r.companyName || '—' },
    { key: 'subject', header: 'Subject' },
    { key: 'source', header: 'Source', render: (r) => <Badge value={r.source} /> },
    { key: 'assignee', header: 'Assigned To', render: (r) => r.assignedEmployee ? `${r.assignedEmployee.firstName} ${r.assignedEmployee.lastName}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'followUp', header: 'Follow-up', render: (r) => r.followUpOverdue
        ? <span className="badge badge-red">FOLLOW-UP OVERDUE</span>
        : (r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : '—'),
    },
    {
      key: 'actions', header: '', render: (r) => (
        <>
          {(isManager || r.assignedEmployee?.id === user.id) && (
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Update</button>
          )}
          {user.role === 'SUPER_ADMIN' && (
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(r)} aria-label="Delete enquiry">
              <Trash2 size={14} />
            </button>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Enquiries"
        subtitle="Inbound enquiry pipeline — from first contact to conversion"
        actions={(
          <>
            {user.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/enquiries', 'enquiries.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/enquiries?format=xlsx', 'enquiries.xlsx')}>Export Excel</button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Enquiry</button>
          </>
        )}
      />

      <div className="toolbar">
        <input className="search-input" placeholder="Search by contact, company, subject or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={enquiries} emptyMessage="No enquiries recorded yet." />}

      {showModal && (
        <Modal title="New Enquiry" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Contact Name<input required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
            <label>Company<input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
            <label>Email<input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
            <label>Phone<input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label>Subject<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>Source
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Follow-up Date<input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></label>
            {isManager && (
              <label>Assigned Employee
                <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
                  <option value="">— None —</option>
                  {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </label>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Update — ${editing.subject}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Follow-up Date<input type="date" value={editForm.followUpDate} onChange={(e) => setEditForm({ ...editForm, followUpDate: e.target.value })} /></label>
            {isManager && (
              <label>Assigned Employee
                <select value={editForm.assignedEmployeeId} onChange={(e) => setEditForm({ ...editForm, assignedEmployeeId: e.target.value })}>
                  <option value="">— None —</option>
                  {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </label>
            )}
            <label>Next Action<input value={editForm.nextAction} onChange={(e) => setEditForm({ ...editForm, nextAction: e.target.value })} /></label>
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
