import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const ENTITY_TYPES = ['EMPLOYEE', 'INTERN', 'TRAINEE', 'COLLEGE', 'WORKSHOP'];
const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTISELECT', 'CHECKBOX', 'TEXTAREA'];
const NEEDS_OPTIONS = ['DROPDOWN', 'MULTISELECT'];

const emptyForm = { entityType: 'EMPLOYEE', name: '', fieldType: 'TEXT', options: '', required: false };

export default function CustomFields() {
  const [entityFilter, setEntityFilter] = useState('EMPLOYEE');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/custom-fields/all').then(({ data }) => setFields(data.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/custom-fields', {
        ...form,
        options: NEEDS_OPTIONS.includes(form.fieldType) ? form.options.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      toast.success('Custom field added');
      setShowModal(false);
      setForm({ ...emptyForm, entityType: entityFilter });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add custom field');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/custom-fields/${row.id}`, { active: !row.active });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove custom field "${row.name}"? This also deletes every value stored for it.`)) return;
    try {
      await api.delete(`/custom-fields/${row.id}`);
      toast.success('Custom field removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  const rows = fields.filter((f) => f.entityType === entityFilter);

  const columns = [
    { key: 'name', header: 'Field Name' },
    { key: 'fieldType', header: 'Type', render: (r) => <Badge value={r.fieldType} /> },
    { key: 'options', header: 'Options', render: (r) => r.options?.length ? r.options.join(', ') : '—' },
    { key: 'required', header: 'Required', render: (r) => (r.required ? 'Yes' : 'No') },
    { key: 'active', header: 'Status', render: (r) => (
      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(r)}>{r.active ? 'Active' : 'Inactive'}</button>
    ) },
    { key: 'actions', header: '', align: 'actions', render: (r) => <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}><Trash2 size={14} /> Remove</button> },
  ];

  return (
    <div>
      <PageHeader
        title="Configuration — Custom Fields"
        subtitle="Add extra fields to employee, intern, trainee, college and workshop records without touching code"
        actions={<button className="btn btn-primary" onClick={() => { setForm({ ...emptyForm, entityType: entityFilter }); setShowModal(true); }}><Plus size={14} /> Add Field</button>}
      />

      <div className="toolbar">
        {ENTITY_TYPES.map((t) => (
          <button key={t} className={`btn ${entityFilter === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEntityFilter(t)}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={rows} emptyMessage="No custom fields defined for this entity type yet." />}

      {showModal && (
        <Modal title="Add Custom Field" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Applies To
              <select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
                {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
            <label>Field Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. T-Shirt Size" /></label>
            <label>Field Type
              <select value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value })}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
            {NEEDS_OPTIONS.includes(form.fieldType) && (
              <label>Options (comma-separated)<input required value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="e.g. S, M, L, XL" /></label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
              Required field
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
