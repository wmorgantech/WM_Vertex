import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, RotateCcw, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

// Cosmetic-only relabeling of two existing TaskStatus codes; the codes
// themselves (and every other status's label) are unchanged. Applied at
// render time rather than in the database so status filtering/business
// logic keeps using the real codes untouched.
const STATUS_LABEL_OVERRIDES = { NOT_ASSIGNED: 'Unassigned', DONE: 'Completed' };
const statusLabel = (s) => STATUS_LABEL_OVERRIDES[s.code] || s.label;
const PAGE_SIZE = 25;
// Active/All/Trash — same deletedAt-based convention as every other module
// this session, kept fully independent of the existing `status` (TaskStatus)
// filter below. Only Super Admin ever sees Trash (matches Delete/Restore
// being Super-Admin-only).
const VIEW_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'trash', label: '🗑️ Trash' },
];

export default function Tasks() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [viewing, setViewing] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unallocatedOnly, setUnallocatedOnly] = useState(false);
  const [viewTab, setViewTab] = useState('active');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'DAILY', priority: 'MEDIUM', dueDate: '', assigneeId: '', projectId: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = () => {
    setLoading(true);
    // Employees/Interns default to their own active (non-Completed) tasks;
    // Admin/Super Admin's default stays fully unfiltered, matching today's
    // existing allocation workflow. Picking any specific status (including
    // Completed) from the dropdown always wins over this default for
    // everyone — `assigneeId` scoping to the caller is enforced server-side
    // regardless of role, so this only changes which of a user's own
    // already-visible tasks show up, not who can see what.
    const calls = [
      api.get('/tasks', {
        params: {
          status: statusFilter || undefined,
          excludeStatus: !statusFilter && !isManager ? 'DONE' : undefined,
          unallocated: unallocatedOnly ? 'true' : undefined,
          search: debouncedSearch || undefined,
          scope: isSuperAdmin ? viewTab : undefined,
          page,
          limit: PAGE_SIZE,
        },
      }),
      api.get('/masters/task-statuses'),
      api.get('/masters/task-priorities'),
      api.get('/masters/task-types'),
    ];
    if (isManager) {
      calls.push(api.get('/users'), api.get('/projects'));
    }
    Promise.allSettled(calls).then((results) => {
      const [t, st, pr, ty, u, p] = results;
      if (t.status === 'fulfilled') {
        setTasks(t.value.data.data);
        setMeta(t.value.data.meta || null);
        setSelectedIds(new Set());
      }
      if (st.status === 'fulfilled') setStatuses(st.value.data.data.filter((x) => x.active));
      if (pr.status === 'fulfilled') setPriorities(pr.value.data.data.filter((x) => x.active));
      if (ty.status === 'fulfilled') setTypes(ty.value.data.data.filter((x) => x.active));
      if (u?.status === 'fulfilled') setUsers(u.value.data.data);
      if (p?.status === 'fulfilled') setProjects(p.value.data.data);

      const failed = results.find((r) => r.status === 'rejected');
      if (failed) {
        const status = failed.reason?.response?.status;
        const message = status === 429
          ? 'Too many requests right now — some data may be out of date. Please wait a moment and refresh.'
          : (failed.reason?.response?.data?.message || 'Some task data failed to load — showing partial results.');
        toast.error(message);
      }
    }).finally(() => setLoading(false));
  };
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, unallocatedOnly, viewTab]);
  useEffect(load, [debouncedSearch, statusFilter, unallocatedOnly, viewTab, page]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tasks', { ...form, projectId: form.projectId || null });
      toast.success('Task created');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (taskId, status) => {
    try {
      // The backend sets progress to 100% automatically when the chosen
      // status is configured as final — no need to guess that here.
      await api.put(`/tasks/${taskId}`, { status });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  };

  const openEdit = (t) => {
    setEditing(t);
    setEditForm({
      title: t.title, description: t.description || '', priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
      assigneeId: t.assignee?.id || '', projectId: t.project?.id || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/tasks/${editing.id}`, { ...editForm, projectId: editForm.projectId || null, assigneeId: editForm.assigneeId || null });
      toast.success('Task updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Remove task "${t.title}"? It will move to Trash — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/tasks/${t.id}`);
      toast.success('Task moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove task');
    }
  };

  const handleRestore = async (t) => {
    try {
      await api.post(`/tasks/${t.id}/restore`);
      toast.success('Task restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore task');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected task(s)? They will move to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/tasks/${id}`)));
      toast.success(`${ids.length} task(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected tasks');
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
  const visibleIds = tasks.map((t) => t.id);
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

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportErrors(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/tasks/import', formData);
      toast.success(data.data.message || `${data.data.imported} task(s) imported`);
      load();
    } catch (err) {
      const details = err.response?.data?.details;
      if (details?.errors?.length) {
        setImportErrors(details.errors);
        toast.error(`${details.errors.length} row(s) failed validation — nothing was imported. See details below.`);
      } else {
        toast.error(err.response?.data?.message || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible tasks"
        checked={allVisibleSelected}
        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
        onChange={toggleSelectAllVisible}
      />
    ),
    render: (r) => (
      <input
        type="checkbox"
        aria-label={`Select ${r.title}`}
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelectOne(r.id)}
      />
    ),
  };

  const columns = [
    ...(isSuperAdmin ? [selectColumn] : []),
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'title', header: 'Task' },
    ...(isManager ? [{
      key: 'assignee', header: 'Assignee',
      render: (r) => r.assignee
        ? `${r.assignee.firstName} ${r.assignee.lastName}`
        : <span className="badge badge-red">NOT ALLOCATED</span>,
    }] : []),
    { key: 'createdBy', header: 'Assigned By', render: (r) => r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'priority', header: 'Priority', render: (r) => <Badge value={r.priority} /> },
    { key: 'dueDate', header: 'Due', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
    { key: 'progress', header: 'Progress', render: (r) => `${r.progress}%` },
    {
      key: 'status', header: 'Status', render: (r) => (
        <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}>
          {statuses.map((s) => <option key={s.code} value={s.code}>{statusLabel(s)}</option>)}
        </select>
      ),
    },
    ...(isManager ? [{
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    }] : []),
  ];

  const trashColumns = [
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'title', header: 'Task' },
    { key: 'assignee', header: 'Assignee', render: (r) => r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            isSuperAdmin && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isManager ? 'Task Management' : 'My Tasks'}
        subtitle="Daily and project-based tasks with priority and deadline tracking"
        actions={(
          <>
            {user.role === 'SUPER_ADMIN' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleImportFile}
                />
                <button className="btn btn-secondary" onClick={handleImportClick} disabled={importing}>
                  <Upload size={14} /> {importing ? 'Importing...' : 'Import'}
                </button>
                <button className="btn btn-secondary" onClick={() => downloadReport(`/reports/tasks?${new URLSearchParams(statusFilter ? { status: statusFilter } : {})}`, 'tasks.csv')}><FileText size={14} /> Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport(`/reports/tasks?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), format: 'xlsx' })}`, 'tasks.xlsx')}><FileSpreadsheet size={14} /> Export Excel</button>
              </>
            )}
            {isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Task</button>}
          </>
        )}
      />

      {isSuperAdmin && (
        <div className="tabs">
          {VIEW_TABS.map((t) => (
            <button key={t.value} className={`tab ${viewTab === t.value ? 'active' : ''}`} onClick={() => setViewTab(t.value)}>{t.label}</button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <input className="search-input" placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{isManager ? 'All statuses' : 'Active'}</option>
          {statuses.map((s) => <option key={s.code} value={s.code}>{statusLabel(s)}</option>)}
        </select>
        {isManager && (
          <label className={`filter-chip${unallocatedOnly ? ' is-active' : ''}`}>
            <input type="checkbox" checked={unallocatedOnly} onChange={(e) => setUnallocatedOnly(e.target.checked)} />
            Not Allocated Only
          </label>
        )}
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
        <>
          <DataTable
            columns={viewTab === 'trash' && isSuperAdmin ? trashColumns : columns}
            rows={tasks}
            emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No tasks found.'}
          />
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}

      {showModal && (
        <Modal title="New Task" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>
            <label>Priority
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {priorities.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </label>
            <label>Due Date<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            <label>Assignee
              <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">— Not allocated yet —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Project (optional)
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">— None —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal size="wide" title={viewing.title} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.priority} />
              <Badge value={viewing.status} label={statuses.find((s) => s.code === viewing.status) ? statusLabel(statuses.find((s) => s.code === viewing.status)) : undefined} />
            </div>
            <div className="detail-grid">
              <DetailField label="ID" value={viewing.id} />
              <DetailField label="Assignee" value={viewing.assignee ? `${viewing.assignee.firstName} ${viewing.assignee.lastName}` : 'Not allocated'} />
              <DetailField label="Assigned By" value={viewing.createdBy ? `${viewing.createdBy.firstName} ${viewing.createdBy.lastName}` : null} />
              <DetailField label="Project" value={viewing.project?.name} />
              <DetailField label="Type" value={viewing.type} />
              <DetailField label="Due Date" value={viewing.dueDate ? new Date(viewing.dueDate).toLocaleDateString() : null} />
              <DetailField label="Progress" value={`${viewing.progress}%`} />
              <DetailField full label="Description" value={viewing.description} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit Task — ${editing.title}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Title<input required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
            <label>Description<textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
            <label>Priority
              <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {priorities.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </label>
            <label>Due Date<input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} /></label>
            <label>Assignee
              <select value={editForm.assigneeId} onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}>
                <option value="">— Not allocated —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Project
              <select value={editForm.projectId} onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}>
                <option value="">— None —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {importErrors && (
        <Modal size="wide" title={`Import failed — ${importErrors.length} row(s) had errors`} onClose={() => setImportErrors(null)}>
          <p className="empty-state" style={{ padding: 0, textAlign: 'left', marginBottom: 12 }}>
            Nothing was imported — fix these rows in your CSV and try again.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Row</th><th>Title</th><th>Errors</th></tr>
              </thead>
              <tbody>
                {importErrors.map((e) => (
                  <tr key={e.row}>
                    <td>{e.row}</td>
                    <td>{e.title || '—'}</td>
                    <td>{e.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setImportErrors(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
