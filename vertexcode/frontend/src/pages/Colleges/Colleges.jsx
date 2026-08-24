import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const emptyForm = { name: '', typeCode: '', university: '', city: '', state: '', contactPerson: '', phone: '', email: '' };
const emptyDeptForm = { name: '', contactPerson: '', contactEmail: '' };

export default function Colleges() {
  const [colleges, setColleges] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDeptForm);
  const [savingDept, setSavingDept] = useState(false);

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
    { key: 'departments', header: 'Departments', render: (r) => r.departments?.length ?? 0 },
    { key: 'workshops', header: 'Workshops', render: (r) => r._count?.workshops ?? 0 },
    { key: 'mous', header: 'MOUs', render: (r) => r._count?.mous ?? 0 },
    { key: 'active', header: 'Status', render: (r) => <Badge value={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'expand', header: '', render: (r) => (
        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
          {expandedId === r.id ? 'Hide depts' : 'Departments'}
        </button>
      ),
    },
  ];

  const expanded = colleges.find((c) => c.id === expandedId);

  return (
    <div>
      <PageHeader
        title="College / Institution Master"
        subtitle="Reusable college records shared across internships, trainees, workshops and MOUs"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add College</button>}
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
        </div>
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
    </div>
  );
}
