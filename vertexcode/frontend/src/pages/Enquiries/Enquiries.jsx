import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, Pencil } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

// All 7 are Business Development pipeline stages — only SUPER_ADMIN/ADMIN
// can move an enquiry through the full set. EMPLOYEE/INTERN work an internal
// enquiry through a narrower, appropriate subset (kept in sync with the
// same restriction enforced server-side in enquiry.controller.js).
const STATUSES = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CONVERTED', 'CLOSED', 'CANCELLED'];
const SELF_SERVICE_VIEW_STATUSES = ['NEW', 'IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CLOSED', 'CANCELLED'];
const SELF_SERVICE_EDIT_STATUSES = ['IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CLOSED', 'CANCELLED'];
const SOURCES = ['WEBSITE', 'REFERRAL', 'PHONE', 'EMAIL', 'WALK_IN', 'SOCIAL_MEDIA', 'OTHER'];

// Internal enquiry topic — separate from `source` (external lead channel,
// unchanged). Role-scoped lists mirror CATEGORIES_BY_ROLE in
// enquiry.controller.js exactly; ADMIN_CATEGORIES also covers SUPER_ADMIN.
const ADMIN_CATEGORIES = [
  { code: 'GENERAL', label: 'General' }, { code: 'HR', label: 'HR' }, { code: 'EMPLOYEE', label: 'Employee' },
  { code: 'INTERN', label: 'Intern' }, { code: 'WORK', label: 'Work' }, { code: 'CLIENT', label: 'Client' },
  { code: 'BUSINESS', label: 'Business' }, { code: 'OTHER', label: 'Other' },
];
const EMPLOYEE_CATEGORIES = [
  { code: 'HR', label: 'HR' }, { code: 'PAYROLL', label: 'Payroll / Salary' }, { code: 'LEAVE', label: 'Leave' },
  { code: 'ATTENDANCE', label: 'Attendance' }, { code: 'TASK', label: 'Task / Work' },
  { code: 'IT_SUPPORT', label: 'IT / Technical Support' }, { code: 'GENERAL', label: 'General' },
];
const INTERN_CATEGORIES = [
  { code: 'INTERNSHIP', label: 'Internship' }, { code: 'TRAINING', label: 'Training' }, { code: 'TASK', label: 'Task / Work' },
  { code: 'ATTENDANCE', label: 'Attendance' }, { code: 'LEAVE', label: 'Leave' }, { code: 'MENTOR', label: 'Mentor' },
  { code: 'IT_SUPPORT', label: 'IT / Technical Support' }, { code: 'GENERAL', label: 'General' },
];
// Combined lookup so anyone viewing an enquiry (e.g. a manager reviewing an
// Intern's) sees the correct label even for a category outside their own role's list.
const CATEGORY_LABELS = Object.fromEntries(
  [...ADMIN_CATEGORIES, ...EMPLOYEE_CATEGORIES, ...INTERN_CATEGORIES].map((c) => [c.code, c.label])
);
const categoryLabel = (code) => CATEGORY_LABELS[code] || code;

const emptyManagerForm = {
  contactName: '', contactEmail: '', contactPhone: '', companyName: '', category: '', subject: '', description: '',
  source: 'WEBSITE', followUpDate: '', assignedEmployeeId: '',
};
const emptySelfForm = { category: '', subject: '', description: '', followUpDate: '' };

export default function Enquiries() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isIntern = user.role === 'INTERN';
  const roleCategories = isManager ? ADMIN_CATEGORIES : isIntern ? INTERN_CATEGORIES : EMPLOYEE_CATEGORIES;
  const [enquiries, setEnquiries] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(isManager ? emptyManagerForm : emptySelfForm);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    setLoading(true);
    const calls = [api.get('/enquiries', { params: { search: search || undefined, status: statusFilter || undefined, source: (isManager && sourceFilter) || undefined } })];
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
      const payload = isManager
        ? { ...form, followUpDate: form.followUpDate || null, assignedEmployeeId: form.assignedEmployeeId || null }
        : { category: form.category, subject: form.subject, description: form.description, followUpDate: form.followUpDate || null };
      await api.post('/enquiries', payload);
      toast.success('Enquiry logged');
      setShowModal(false);
      setForm(isManager ? emptyManagerForm : emptySelfForm);
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
      status: en.status, category: en.category || '', followUpDate: en.followUpDate ? en.followUpDate.slice(0, 10) : '',
      nextAction: en.nextAction || '', remarks: en.remarks || '',
      assignedEmployeeId: en.assignedEmployee?.id || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = isManager
        ? { ...editForm, followUpDate: editForm.followUpDate || null, assignedEmployeeId: editForm.assignedEmployeeId || null }
        : { status: editForm.status, category: editForm.category, followUpDate: editForm.followUpDate || null };
      await api.put(`/enquiries/${editing.id}`, payload);
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

  const columns = isManager ? [
    { key: 'contactName', header: 'Contact' },
    { key: 'category', header: 'Category', render: (r) => r.category ? categoryLabel(r.category) : '—' },
    { key: 'subject', header: 'Subject' },
    { key: 'assignee', header: 'Assigned To', render: (r) => r.assignedEmployee ? `${r.assignedEmployee.firstName} ${r.assignedEmployee.lastName}` : '—' },
    {
      key: 'followUp', header: 'Follow-up', render: (r) => r.followUpOverdue
        ? <span className="badge badge-red">FOLLOW-UP OVERDUE</span>
        : (r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : '—'),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions', header: '', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            { key: 'edit', icon: Pencil, label: 'Update', onClick: () => openEdit(r) },
            user.role === 'SUPER_ADMIN' && { key: 'trash', icon: Trash2, label: 'Delete enquiry', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ] : [
    { key: 'category', header: 'Category', render: (r) => r.category ? categoryLabel(r.category) : '—' },
    { key: 'subject', header: 'Subject' },
    {
      key: 'followUp', header: 'Follow-up', render: (r) => r.followUpOverdue
        ? <span className="badge badge-red">FOLLOW-UP OVERDUE</span>
        : (r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : '—'),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions', header: '', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            r.assignedEmployee?.id === user.id && { key: 'edit', icon: Pencil, label: 'Update', onClick: () => openEdit(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isManager ? 'Enquiries' : 'My Enquiries'}
        subtitle={isManager ? 'Inbound enquiry pipeline — from first contact to conversion' : 'Raise and track your own enquiries'}
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
          {(isManager ? STATUSES : SELF_SERVICE_VIEW_STATUSES).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {isManager && (
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        )}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={enquiries} emptyMessage="No enquiries recorded yet." />}

      {showModal && (
        <Modal title="New Enquiry" onClose={() => setShowModal(false)}>
          {isManager ? (
            <form className="form-grid" onSubmit={handleCreate}>
              <label>Contact Name<input required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
              <label>Company<input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
              <label>Email<input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
              <label>Phone<input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
              <label>Category
                <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">— Select —</option>
                  {roleCategories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </label>
              <label>Source
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label>Subject / Requirement<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
              <label>Enquiry Details<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label>Assigned Employee
                <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
                  <option value="">— None —</option>
                  {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </label>
              <label>Follow-up Date<input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></label>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleCreate}>
              <DetailField label="Requester" value={`${user.firstName} ${user.lastName}`} />
              <label>Enquiry Category
                <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">— Select —</option>
                  {roleCategories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </label>
              <label>Subject<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
              <label>Enquiry Details<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label>Follow-up Date<input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></label>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {viewing && (
        <Modal size="wide" title={viewing.subject} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.status} />
              {viewing.category && <span className="badge badge-gray">{categoryLabel(viewing.category)}</span>}
            </div>
            {isManager ? (
              <div className="detail-grid">
                <DetailField label="Contact Name" value={viewing.contactName} />
                <DetailField label="Company" value={viewing.companyName} />
                <DetailField label="Email" value={viewing.contactEmail} />
                <DetailField label="Phone" value={viewing.contactPhone} />
                <DetailField label="Category" value={viewing.category ? categoryLabel(viewing.category) : null} />
                <DetailField label="Source" value={viewing.source} />
                <DetailField label="Assigned To" value={viewing.assignedEmployee ? `${viewing.assignedEmployee.firstName} ${viewing.assignedEmployee.lastName}` : 'Unassigned'} />
                <DetailField label="Follow-up Date" value={viewing.followUpDate ? new Date(viewing.followUpDate).toLocaleDateString() : null} />
                <DetailField full label="Enquiry Details" value={viewing.description} />
                <DetailField full label="Next Action" value={viewing.nextAction} />
                <DetailField full label="Remarks" value={viewing.remarks} />
                <DetailField label="Created" value={new Date(viewing.createdAt).toLocaleString()} />
                <DetailField label="Last Updated" value={new Date(viewing.updatedAt).toLocaleString()} />
              </div>
            ) : (
              <div className="detail-grid">
                <DetailField label="Requester" value={viewing.contactName} />
                <DetailField label="Category" value={viewing.category ? categoryLabel(viewing.category) : null} />
                <DetailField label="Follow-up Date" value={viewing.followUpDate ? new Date(viewing.followUpDate).toLocaleDateString() : null} />
                <DetailField full label="Enquiry Details" value={viewing.description} />
                <DetailField label="Created Date" value={new Date(viewing.createdAt).toLocaleString()} />
                <DetailField label="Updated Date" value={new Date(viewing.updatedAt).toLocaleString()} />
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Update — ${editing.subject}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {(isManager ? STATUSES : SELF_SERVICE_EDIT_STATUSES).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Category
              <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                <option value="">— Select —</option>
                {roleCategories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label>Follow-up Date<input type="date" value={editForm.followUpDate} onChange={(e) => setEditForm({ ...editForm, followUpDate: e.target.value })} /></label>
            {isManager && (
              <>
                <label>Assigned Employee
                  <select value={editForm.assignedEmployeeId} onChange={(e) => setEditForm({ ...editForm, assignedEmployeeId: e.target.value })}>
                    <option value="">— None —</option>
                    {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </label>
                <label>Next Action<input value={editForm.nextAction} onChange={(e) => setEditForm({ ...editForm, nextAction: e.target.value })} /></label>
                <label>Remarks<textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></label>
              </>
            )}
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
