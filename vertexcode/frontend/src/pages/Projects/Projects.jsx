import { useEffect, useState } from 'react';
import { Plus, Eye, Pencil, Trash2, RotateCcw, FolderKanban, Activity, CheckCircle2, Search } from 'lucide-react';
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

const STATUS_OPTIONS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
// List-view status filter — deliberately only the four statuses called out
// as useful for browsing (CANCELLED is a real, settable status via
// Edit/STATUS_OPTIONS above, just not one of the requested list filters;
// it still shows up under "All Statuses", nothing is hidden entirely).
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [priorities, setPriorities] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
      api.get('/projects', {
        params: {
          scope: viewTab,
          // Status filtering is completely separate from Trash — never sent
          // while browsing Trash, so it can't narrow/hide trashed rows.
          status: viewTab === 'trash' ? undefined : (statusFilter || undefined),
          priority: viewTab === 'trash' ? undefined : (priorityFilter || undefined),
          search: debouncedSearch || undefined,
        },
      }),
      api.get('/projects/summary'),
      api.get('/masters/task-priorities'),
    ])
      .then(([p, s, pr]) => {
        if (p.status === 'fulfilled') {
          setProjects(p.value.data.data);
          setSelectedIds(new Set());
        }
        if (s.status === 'fulfilled') setSummary(s.value.data.data);
        if (pr.status === 'fulfilled') setPriorities(pr.value.data.data.filter((item) => item.active));
        const failed = [p, s, pr].find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some project data failed to load');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(load, [viewTab, statusFilter, priorityFilter, debouncedSearch]);

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

  // Irreversible — DELETE /projects/:id/permanent (Super Admin only,
  // requires the project already be in Trash) — same pattern as
  // Employees/Interns/Trainees/Departments' permanent delete.
  const handlePermanentlyDelete = async (p) => {
    if (!window.confirm(`Permanently delete project "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${p.id}/permanent`);
      toast.success('Project permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete project');
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
            isSuperAdmin && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDelete(r) },
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
        <StatCard label="Trash" value={summary.trash} accent="red" icon={Trash2} />
      </div>

      <div className="toolbar">
        <button className={`tab ${viewTab === 'trash' ? 'active' : ''}`} onClick={() => setViewTab(viewTab === 'trash' ? 'all' : 'trash')}>
          🗑️ Trash{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}
        </button>
        <div className="toolbar-actions">
          <span className="search-input-wrap">
            <Search size={16} strokeWidth={2.5} />
            <input className="search-input" placeholder="Search by name or description..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search projects" />
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={viewTab === 'trash'}
            title={viewTab === 'trash' ? 'Status filter does not apply to Trash' : undefined}
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            disabled={viewTab === 'trash'}
            aria-label="Filter by task priority"
          >
            <option value="">All Task Priorities</option>
            {priorities.map((priority) => <option key={priority.code} value={priority.code}>{priority.label}</option>)}
          </select>
        </div>
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
