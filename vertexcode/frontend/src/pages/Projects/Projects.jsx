import { useEffect, useState } from 'react';
import { Plus, Eye, Pencil, Trash2, RotateCcw, FolderKanban, Activity, CheckCircle2, Archive } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';

const VIEW_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'trash', label: '🗑️ Trash' },
];
const STATUS_OPTIONS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState('active');
  const [summary, setSummary] = useState({ total: 0, active: 0, completed: 0, trash: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'PLANNED', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', status: 'PLANNED', startDate: '', endDate: '' });

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/projects', { params: { scope: viewTab } }),
      api.get('/projects/summary'),
    ])
      .then(([p, s]) => {
        if (p.status === 'fulfilled') {
          setProjects(p.value.data.data);
          setSelectedIds(new Set());
        }
        if (s.status === 'fulfilled') setSummary(s.value.data.data);
        const failed = [p, s].find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some project data failed to load');
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [viewTab]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/projects', form);
      toast.success('Project created');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setEditForm({
      name: p.name, description: p.description || '', status: p.status,
      startDate: p.startDate ? p.startDate.slice(0, 10) : '', endDate: p.endDate ? p.endDate.slice(0, 10) : '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/projects/${editing.id}`, editForm);
      toast.success('Project updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Remove project "${p.name}"? It will move to Trash — this can be undone with Restore. Existing tasks/timesheets are preserved.`)) return;
    try {
      await api.delete(`/projects/${p.id}`);
      toast.success('Project moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove project');
    }
  };

  const handleRestore = async (p) => {
    try {
      await api.post(`/projects/${p.id}/restore`);
      toast.success('Project restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore project');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected project(s)? They will move to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/projects/${id}`)));
      toast.success(`${ids.length} project(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected projects');
    } finally {
      setSelectedIds(new Set());
      load();
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleIds = projects.map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible projects"
        checked={allVisibleSelected}
        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
        onChange={toggleSelectAllVisible}
      />
    ),
    render: (r) => (
      <input
        type="checkbox"
        aria-label={`Select ${r.name}`}
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelectOne(r.id)}
      />
    ),
  };

  const columns = [
    ...(isSuperAdmin ? [selectColumn] : []),
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'name', header: 'Project', render: (r) => <Link to={`/projects/${r.id}`}>{r.name}</Link> },
    { key: 'manager', header: 'Manager', render: (r) => `${r.manager.firstName} ${r.manager.lastName}` },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'members', header: 'Members', render: (r) => r.members?.length ?? 0 },
    { key: 'tasks', header: 'Tasks', render: (r) => r._count?.tasks ?? 0 },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => navigate(`/projects/${r.id}`) },
            isManager && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  const trashColumns = [
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'name', header: 'Project', render: (r) => <Link to={`/projects/${r.id}`}>{r.name}</Link> },
    { key: 'manager', header: 'Manager', render: (r) => `${r.manager.firstName} ${r.manager.lastName}` },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'deletedAt', header: 'Removed Date', render: (r) => r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : '—' },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => navigate(`/projects/${r.id}`) },
            isSuperAdmin && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Project-based work across the organization"
        actions={isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Project</button>}
      />

      <div className="stat-grid">
        <StatCard label="Total Projects" value={summary.total} accent="blue" icon={FolderKanban} />
        <StatCard label="Active" value={summary.active} accent="green" icon={Activity} />
        <StatCard label="Completed" value={summary.completed} accent="purple" icon={CheckCircle2} />
        <StatCard label="Trash" value={summary.trash} accent="red" icon={Archive} />
      </div>

      <div className="tabs">
        {VIEW_TABS.map((t) => (
          <button key={t.value} className={`tab ${viewTab === t.value ? 'active' : ''}`} onClick={() => setViewTab(t.value)}>
            {t.value === 'trash' ? (<>{t.label}{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}</>) : t.label}
          </button>
        ))}
      </div>

      {isSuperAdmin && viewTab !== 'trash' && selectedIds.size > 0 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <span>{selectedIds.size} selected</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={14} /> Delete Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        <DataTable
          columns={viewTab === 'trash' ? trashColumns : columns}
          rows={projects}
          emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No projects found.'}
        />
      )}

      {showModal && (
        <Modal title="New Project" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.filter((s) => s !== 'CANCELLED').map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Start Date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
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
            <label>Description<textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Start Date<input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} /></label>
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
