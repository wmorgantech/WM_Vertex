import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, Search, RotateCcw, Building2 } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import CustomFieldsSection from '../../components/common/CustomFieldsSection';
import toast from 'react-hot-toast';

const emptyForm = { name: '', typeCode: '', university: '', city: '', state: '', contactPerson: '', phone: '', email: '' };
const emptyDeptForm = { name: '', contactPerson: '', contactEmail: '' };

export default function Colleges() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [viewing, setViewing] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewTab, setViewTab] = useState('active');
  const [summary, setSummary] = useState({ total: 0, trash: 0 });

  const [expandedId, setExpandedId] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDeptForm);
  const [savingDept, setSavingDept] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/colleges', { params: { scope: viewTab, search: debouncedSearch || undefined } }),
      api.get('/colleges/summary'),
      api.get('/masters/college-types'),
    ])
      .then(([c, s, t]) => {
        if (c.status === 'fulfilled') { setColleges(c.value.data.data); setExpandedId(null); }
        if (s.status === 'fulfilled') setSummary(s.value.data.data);
        if (t.status === 'fulfilled') setTypes(t.value.data.data.filter((x) => x.active));
        const failed = [c, s, t].find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some college data failed to load');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(load, [viewTab, debouncedSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/colleges', { ...form, typeCode: form.typeCode || null });
      toast.success('College added');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add college');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c) => {
    setEditing(c);
    setEditForm({
      name: c.name, typeCode: c.typeCode || '', university: c.university || '', city: c.city || '',
      state: c.state || '', contactPerson: c.contactPerson || '', phone: c.phone || '', email: c.email || '',
      active: c.active,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/colleges/${editing.id}`, { ...editForm, typeCode: editForm.typeCode || null });
      toast.success('College updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update college');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Remove "${c.name}"? It will move to Trash — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/colleges/${c.id}`);
      toast.success('College moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove college');
    }
  };

  const handleRestore = async (c) => {
    try {
      await api.post(`/colleges/${c.id}/restore`);
      toast.success('College restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore college');
    }
  };

  // Irreversible — DELETE /colleges/:id/permanent (Super Admin only,
  // requires the college already be in Trash). Departments cascade; if
  // Workshops/MOUs still reference this college, the backend's FK
  // constraint rejects the delete with a clear error.
  const handlePermanentlyDelete = async (c) => {
    if (!window.confirm(`Permanently delete "${c.name}"? This will also remove its departments. This cannot be undone.`)) return;
    try {
      await api.delete(`/colleges/${c.id}/permanent`);
      toast.success('College permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete college');
    }
  };

  const handleAddDept = async (e, collegeId) => {
    e.preventDefault();
    setSavingDept(true);
    try {
      await api.post('/colleges/departments', { ...deptForm, collegeId });
      toast.success('Department added');
      setDeptForm(emptyDeptForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add department');
    } finally {
      setSavingDept(false);
    }
  };

  const columns = [
    { key: 'name', header: 'College' },
    { key: 'type', header: 'Type', render: (r) => r.type?.label || '—' },
    { key: 'city', header: 'City', render: (r) => r.city || '—' },
    { key: 'contactPerson', header: 'Contact', render: (r) => r.contactPerson || '—' },
    { key: 'workshops', header: 'Workshops', render: (r) => r._count?.workshops ?? 0 },
    { key: 'mous', header: 'MOUs', render: (r) => r._count?.mous ?? 0 },
    { key: 'active', header: 'Status', render: (r) => <Badge value={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'expand', header: '', render: (r) => (
        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
          {expandedId === r.id ? 'Hide depts' : 'Manage depts'}
        </button>
      ),
    },
    {
      key: 'actions', header: 'Actions', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  // Trash gets its own, narrower column set — no Edit/Manage depts on an
  // already-removed record, just enough to identify it, restore it, or
  // (Super Admin only) permanently delete it — same convention as
  // Departments/Projects' trashColumns.
  const trashColumns = [
    { key: 'name', header: 'College' },
    { key: 'type', header: 'Type', render: (r) => r.type?.label || '—' },
    { key: 'city', header: 'City', render: (r) => r.city || '—' },
    { key: 'deletedAt', header: 'Removed Date', render: (r) => r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : '—' },
    {
      key: 'actions', header: 'Actions', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            isSuperAdmin && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
            isSuperAdmin && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDelete(r) },
          ]}
        />
      ),
    },
  ];

  const expanded = viewTab === 'trash' ? null : colleges.find((c) => c.id === expandedId);

  return (
    <div>
      <PageHeader
        title="College / Institution Master"
        subtitle="Reusable college records shared across internships, trainees, workshops and MOUs"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add College</button>}
      />

      <div className="stat-grid">
        <StatCard label="Total Colleges" value={summary.total} accent="blue" icon={Building2} />
        <StatCard label="Trash" value={summary.trash} accent="red" icon={Trash2} />
      </div>

      <div className="toolbar">
        <span className="search-input-wrap">
          <Search size={16} strokeWidth={2.5} />
          <input className="search-input" placeholder="Search by name, city or contact..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search colleges" />
        </span>
        <div className="toolbar-actions">
          <button type="button" className={`tab ${viewTab === 'trash' ? 'active' : ''}`} onClick={() => setViewTab(viewTab === 'trash' ? 'active' : 'trash')}>
            🗑️ Trash{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}
          </button>
        </div>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : (
        <DataTable
          columns={viewTab === 'trash' ? trashColumns : columns}
          rows={colleges}
          emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No colleges added yet.'}
        />
      )}

      {expanded && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{expanded.name} — Departments</h3>
          {/* Newest first (departments come back from the API already
              sorted by createdAt desc), rendered as cards instead of a
              plain bullet list, so a just-added department is always the
              first card here — immediately visible with no scrolling. */}
          {expanded.departments.length === 0 ? (
            <div className="empty-state">No departments recorded yet.</div>
          ) : (
            <div className="card-grid" style={{ marginBottom: 0 }}>
              {expanded.departments.map((d) => (
                <div key={d.id} className="card" style={{ padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{d.name}</p>
                  {(d.contactPerson || d.contactEmail) && (
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                      {[d.contactPerson, d.contactEmail].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <form className="form-grid" style={{ marginTop: 16 }} onSubmit={(e) => handleAddDept(e, expanded.id)}>
            <label>Department Name<input required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} /></label>
            <label>Contact Person<input value={deptForm.contactPerson} onChange={(e) => setDeptForm({ ...deptForm, contactPerson: e.target.value })} /></label>
            <label>Contact Email<input value={deptForm.contactEmail} onChange={(e) => setDeptForm({ ...deptForm, contactEmail: e.target.value })} /></label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingDept}>{savingDept ? 'Saving...' : '+ Add Department'}</button>
            </div>
          </form>
          <div style={{ marginTop: 16 }}>
            <CustomFieldsSection entityType="COLLEGE" entityId={expanded.id} />
          </div>
        </div>
      )}

      {viewing && (
        <Modal size="wide" title={viewing.name} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.active ? 'ACTIVE' : 'INACTIVE'} />
              {viewing.type?.label && <span className="detail-field-value">{viewing.type.label}</span>}
            </div>
            <div className="detail-section">
              <p className="detail-section-title">College Information</p>
              <div className="detail-grid">
                <DetailField label="University" value={viewing.university} />
                <DetailField label="City" value={viewing.city} />
                <DetailField label="State" value={viewing.state} />
                <DetailField label="Contact Person" value={viewing.contactPerson} />
                <DetailField label="Phone" value={viewing.phone} />
                <DetailField label="Email" value={viewing.email} />
                <DetailField label="Workshops" value={viewing._count?.workshops ?? 0} />
                <DetailField label="MOUs" value={viewing._count?.mous ?? 0} />
              </div>
            </div>
            <div className="detail-section">
              <p className="detail-section-title">Departments</p>
              {viewing.departments?.length ? (
                <div className="detail-grid">
                  {viewing.departments.map((d) => (
                    <DetailField key={d.id} label={d.name} value={d.contactPerson || d.contactEmail || '—'} />
                  ))}
                </div>
              ) : (
                <p className="detail-field-value">No departments recorded.</p>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title="Add College" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Type
              <select value={form.typeCode} onChange={(e) => setForm({ ...form, typeCode: e.target.value })}>
                <option value="">— None —</option>
                {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>
            <label>University<input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} /></label>
            <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label>State<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit — ${editing.name}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Name<input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
            <label>Type
              <select value={editForm.typeCode} onChange={(e) => setEditForm({ ...editForm, typeCode: e.target.value })}>
                <option value="">— None —</option>
                {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>
            <label>University<input value={editForm.university} onChange={(e) => setEditForm({ ...editForm, university: e.target.value })} /></label>
            <label>City<input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></label>
            <label>State<input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} /></label>
            <label>Contact Person<input value={editForm.contactPerson} onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })} /></label>
            <label>Phone<input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>
            <label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
              Active
            </label>
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
