import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'designations', label: 'Designations' },
  { key: 'locations', label: 'Locations' },
  { key: 'employment-types', label: 'Employment Types' },
  { key: 'college-types', label: 'College Types' },
  { key: 'task-types', label: 'Task Types' },
  { key: 'task-priorities', label: 'Task Priorities' },
  { key: 'task-statuses', label: 'Task Statuses' },
  { key: 'timesheet-statuses', label: 'Timesheet Statuses' },
  { key: 'leave-types', label: 'Leave Types' },
  { key: 'expense-categories', label: 'Expense Categories' },
];

const CODE_LABEL_TABS = ['employment-types', 'college-types', 'task-types', 'task-priorities', 'task-statuses', 'timesheet-statuses', 'leave-types', 'expense-categories'];

// Extra boolean field some code/label masters carry beyond code+label.
const EXTRA_BOOLEAN_FIELD = {
  'task-statuses': { key: 'isFinal', label: 'Final status (auto-completes the task)' },
  'timesheet-statuses': { key: 'isFinal', label: 'Final status' },
  'leave-types': { key: 'paid', label: 'Paid leave' },
};

const EMPTY_FORMS = {
  designations: { name: '', departmentId: '' },
  locations: { name: '', city: '', address: '' },
  'employment-types': { code: '', label: '' },
  'college-types': { code: '', label: '' },
  'task-types': { code: '', label: '' },
  'task-priorities': { code: '', label: '' },
  'task-statuses': { code: '', label: '', isFinal: false },
  'timesheet-statuses': { code: '', label: '', isFinal: false },
  'leave-types': { code: '', label: '', paid: true },
  'expense-categories': { code: '', label: '' },
};

export default function Masters() {
  const [tab, setTab] = useState('designations');
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORMS.designations);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/masters/${tab}`),
      tab === 'designations' ? api.get('/departments') : Promise.resolve({ data: { data: [] } }),
    ])
      .then(([res, dep]) => {
        setRows(res.data.data);
        setDepartments(dep.data.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [tab]);

  useEffect(() => setForm(EMPTY_FORMS[tab]), [tab]);

  const idKey = (row) => (CODE_LABEL_TABS.includes(tab) ? row.code : row.id);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/masters/${tab}`, form);
      toast.success('Created');
      setShowModal(false);
      setForm(EMPTY_FORMS[tab]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/masters/${tab}/${idKey(row)}`, { active: !row.active });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove "${row.name || row.label}"?`)) return;
    try {
      await api.delete(`/masters/${tab}/${idKey(row)}`);
      toast.success('Removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  const baseColumns = {
    designations: [
      { key: 'name', header: 'Designation' },
      { key: 'department', header: 'Department', render: (r) => r.department?.name || '—' },
      { key: 'users', header: 'In Use', render: (r) => r._count?.users ?? 0 },
    ],
    locations: [
      { key: 'name', header: 'Location' },
      { key: 'city', header: 'City', render: (r) => r.city || '—' },
      { key: 'users', header: 'In Use', render: (r) => r._count?.users ?? 0 },
    ],
    'employment-types': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'users', header: 'In Use', render: (r) => r._count?.users ?? 0 },
    ],
    'college-types': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'colleges', header: 'In Use', render: (r) => r._count?.colleges ?? 0 },
    ],
    'task-types': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'tasks', header: 'In Use', render: (r) => r._count?.tasks ?? 0 },
    ],
    'task-priorities': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'tasks', header: 'In Use', render: (r) => r._count?.tasks ?? 0 },
    ],
    'task-statuses': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'isFinal', header: 'Final?', render: (r) => (r.isFinal ? 'Yes' : 'No') },
      { key: 'tasks', header: 'In Use', render: (r) => r._count?.tasks ?? 0 },
    ],
    'timesheet-statuses': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'isFinal', header: 'Final?', render: (r) => (r.isFinal ? 'Yes' : 'No') },
      { key: 'timesheets', header: 'In Use', render: (r) => r._count?.timesheets ?? 0 },
    ],
    'leave-types': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'paid', header: 'Paid?', render: (r) => (r.paid ? 'Yes' : 'No') },
      { key: 'requests', header: 'In Use', render: (r) => r._count?.requests ?? 0 },
    ],
    'expense-categories': [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Label' },
      { key: 'expenses', header: 'In Use', render: (r) => r._count?.expenses ?? 0 },
    ],
  };

  const columns = [
    ...baseColumns[tab],
    { key: 'active', header: 'Status', render: (r) => (
      <button className={`btn btn-ghost btn-sm`} onClick={() => toggleActive(r)}>
        {r.active ? 'Active' : 'Inactive'}
      </button>
    ) },
    { key: 'actions', header: '', render: (r) => (
      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r)}>Remove</button>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Configuration — Master Data"
        subtitle="Configurable lists used across the platform instead of hardcoded values"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add {TABS.find((t) => t.key === tab).label.replace(/s$/, '')}</button>}
      />

      <div className="toolbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={rows} />}

      {showModal && (
        <Modal title={`Add ${TABS.find((t) => t.key === tab).label.replace(/s$/, '')}`} onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            {CODE_LABEL_TABS.includes(tab) ? (
              <>
                <label>Code<input required placeholder="e.g. CONSULTANT" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
                <label>Label<input required placeholder="e.g. Consultant" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
                {EXTRA_BOOLEAN_FIELD[tab] && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={!!form[EXTRA_BOOLEAN_FIELD[tab].key]}
                      onChange={(e) => setForm({ ...form, [EXTRA_BOOLEAN_FIELD[tab].key]: e.target.checked })}
                    />
                    {EXTRA_BOOLEAN_FIELD[tab].label}
                  </label>
                )}
              </>
            ) : (
              <>
                <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                {tab === 'designations' && (
                  <label>Department
                    <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                      <option value="">— None —</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                )}
                {tab === 'locations' && (
                  <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                )}
              </>
            )}
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
