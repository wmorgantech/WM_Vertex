import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

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

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'head', header: 'Head', render: (r) => r.head ? `${r.head.firstName} ${r.head.lastName}` : '—' },
    { key: 'count', header: 'Members', render: (r) => r._count?.users ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Organizational units and structure"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Department</button>}
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
    </div>
  );
}
