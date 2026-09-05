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
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

// Cosmetic-only relabeling of two existing TaskStatus codes; the codes
// themselves (and every other status's label) are unchanged. Applied at
// render time rather than in the database so status filtering/business
// logic keeps using the real codes untouched.
const STATUS_LABEL_OVERRIDES = { NOT_ASSIGNED: 'Unassigned', DONE: 'Completed' };
const statusLabel = (s) => STATUS_LABEL_OVERRIDES[s.code] || s.label;

export default function Tasks() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [viewing, setViewing] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [unallocatedOnly, setUnallocatedOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'DAILY', priority: 'MEDIUM', dueDate: '', assigneeId: '', projectId: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

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
        },
      }),
      api.get('/masters/task-statuses'),
      api.get('/masters/task-priorities'),
      api.get('/masters/task-types'),
    ];
    if (isManager) {
      calls.push(api.get('/users'), api.get('/projects'));
    }
    Promise.all(calls).then(([t, st, pr, ty, u, p]) => {
      setTasks(t.data.data);
      setStatuses(st.data.data.filter((x) => x.active));
      setPriorities(pr.data.data.filter((x) => x.active));
      setTypes(ty.data.data.filter((x) => x.active));
      if (u) setUsers(u.data.data);
      if (p) setProjects(p.data.data);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter, unallocatedOnly]);

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
    if (!window.confirm(`Delete task "${t.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tasks/${t.id}`);
      toast.success('Task removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task');
    }
  };

  const columns = [
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
            user.role === 'SUPER_ADMIN' && { key: 'trash', icon: Trash2, label: 'Delete', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    }] : []),
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
                <button className="btn btn-secondary" onClick={() => downloadReport(`/reports/tasks?${new URLSearchParams(statusFilter ? { status: statusFilter } : {})}`, 'tasks.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport(`/reports/tasks?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), format: 'xlsx' })}`, 'tasks.xlsx')}>Export Excel</button>
              </>
            )}
            {isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Task</button>}
          </>
        )}
      />

      <div className="toolbar">
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

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={tasks} />}

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
    </div>
  );
}
