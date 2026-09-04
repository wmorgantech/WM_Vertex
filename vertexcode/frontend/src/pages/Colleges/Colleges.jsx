import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
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

  const [expandedId, setExpandedId] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDeptForm);
  const [savingDept, setSavingDept] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/colleges'), api.get('/masters/college-types')])
      .then(([c, t]) => {
        setColleges(c.data.data);
        setTypes(t.data.data.filter((x) => x.active));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

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
    const impacts = [];
    if (c.departments?.length) impacts.push(`${c.departments.length} department(s) will also be deleted`);
    if (c._count?.workshops) impacts.push(`${c._count.workshops} workshop(s) reference this college`);
    if (c._count?.mous) impacts.push(`${c._count.mous} MOU(s) reference this college`);
    const impactText = impacts.length ? `\n\nImpact:\n- ${impacts.join('\n- ')}` : '';
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.${impactText}`)) return;
    try {
      await api.delete(`/colleges/${c.id}`);
      toast.success('College removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete college');
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

  const expanded = colleges.find((c) => c.id === expandedId);

  return (
    <div>
      <PageHeader
        title="College / Institution Master"
        subtitle="Reusable college records shared across internships, trainees, workshops and MOUs"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add College</button>}
      />

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={colleges} emptyMessage="No colleges added yet." />}

      {expanded && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{expanded.name} — Departments</h3>
          {expanded.departments.length === 0 ? (
            <div className="empty-state">No departments recorded yet.</div>
          ) : (
            <ul className="simple-list">
              {expanded.departments.map((d) => (
                <li key={d.id}>{d.name}{d.contactPerson ? ` — ${d.contactPerson}` : ''}{d.contactEmail ? ` (${d.contactEmail})` : ''}</li>
              ))}
            </ul>
          )}
          <form className="form-grid" style={{ marginTop: 12 }} onSubmit={(e) => handleAddDept(e, expanded.id)}>
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
