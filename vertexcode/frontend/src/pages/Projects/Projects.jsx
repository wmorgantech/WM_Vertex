import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

export default function Projects() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'PLANNED', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/projects').then(({ data }) => setProjects(data.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

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

  const columns = [
    { key: 'name', header: 'Project', render: (r) => <Link to={`/projects/${r.id}`}>{r.name}</Link> },
    { key: 'manager', header: 'Manager', render: (r) => `${r.manager.firstName} ${r.manager.lastName}` },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'members', header: 'Members', render: (r) => r.members?.length ?? 0 },
    { key: 'tasks', header: 'Tasks', render: (r) => r._count?.tasks ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Project-based work across the organization"
        actions={isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Project</button>}
      />
      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={projects} />}

      {showModal && (
        <Modal title="New Project" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
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
    </div>
  );
}
