import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import toast from 'react-hot-toast';

export default function Departments() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [viewing, setViewing] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/departments').then(({ data }) => setDepartments(data.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/departments', form);
      toast.success('Department created');
      setShowModal(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  const openView = (d) => {
    setViewing({ ...d, users: null });
    setViewLoading(true);
    api.get(`/departments/${d.id}`)
      .then(({ data }) => setViewing(data.data))
      .catch(() => toast.error('Failed to load department details'))
      .finally(() => setViewLoading(false));
  };

  const openEdit = (d) => {
    setEditing(d);
    setEditForm({ name: d.name, description: d.description || '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/departments/${editing.id}`, editForm);
      toast.success('Department updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete department "${d.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/departments/${d.id}`);
      toast.success('Department removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'head', header: 'Head', render: (r) => r.head ? `${r.head.firstName} ${r.head.lastName}` : '—' },
    { key: 'count', header: 'Members', render: (r) => r._count?.users ?? 0 },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => openView(r) },
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Organizational units and structure"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Department</button>}
      />
      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={departments} />}

      {showModal && (
        <Modal title="Add Department" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-grid">
              <DetailField full label="Description" value={viewing.description} />
              <DetailField label="Head" value={viewing.head ? `${viewing.head.firstName} ${viewing.head.lastName}` : null} />
              <DetailField label="Members" value={viewing.users ? viewing.users.length : viewing._count?.users ?? 0} />
            </div>
            {viewLoading ? (
              <p className="empty-state" style={{ padding: 0, textAlign: 'left' }}>Loading members...</p>
            ) : viewing.users && viewing.users.length > 0 && (
              <div>
                <p className="detail-field-label" style={{ marginBottom: 8 }}>Team</p>
                <div className="detail-grid">
                  {viewing.users.map((u) => (
                    <DetailField key={u.id} label={u.designation || u.role} value={`${u.firstName} ${u.lastName}`} />
                  ))}
                </div>
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit — ${editing.name}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Name<input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
            <label>Description<textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
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
