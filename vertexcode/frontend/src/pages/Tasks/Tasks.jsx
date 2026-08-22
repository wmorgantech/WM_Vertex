import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

export default function Tasks() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'DAILY', priority: 'MEDIUM', dueDate: '', assigneeId: '', projectId: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const calls = [api.get('/tasks', { params: { status: statusFilter || undefined } })];
    if (isManager) {
      calls.push(api.get('/users'), api.get('/projects'));
    }
    Promise.all(calls).then(([t, u, p]) => {
      setTasks(t.data.data);
      if (u) setUsers(u.data.data);
      if (p) setProjects(p.data.data);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter]);

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
      await api.put(`/tasks/${taskId}`, { status, progress: status === 'DONE' ? 100 : undefined });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  };

  const columns = [
    { key: 'title', header: 'Task' },
    ...(isManager ? [{ key: 'assignee', header: 'Assignee', render: (r) => `${r.assignee.firstName} ${r.assignee.lastName}` }] : []),
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'priority', header: 'Priority', render: (r) => <Badge value={r.priority} /> },
    { key: 'dueDate', header: 'Due', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
    { key: 'progress', header: 'Progress', render: (r) => `${r.progress}%` },
    {
      key: 'status', header: 'Status', render: (r) => (
        <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isManager ? 'Task Management' : 'My Tasks'}
        subtitle="Daily and project-based tasks with priority and deadline tracking"
        actions={isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Task</button>}
      />

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={tasks} />}

      {showModal && (
        <Modal title="New Task" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="DAILY">Daily</option>
                <option value="PROJECT">Project-based</option>
              </select>
            </label>
            <label>Priority
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label>Due Date<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            <label>Assignee
              <select required value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">Select user...</option>
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
    </div>
  );
}
