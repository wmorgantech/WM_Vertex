import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const emptyForm = {
  email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE',
  designation: '', employmentType: 'FULL_TIME', departmentId: '', managerId: '',
};

export default function EmployeeList() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/users', { params: { role: undefined, search: search || undefined } }),
      api.get('/departments'),
    ])
      .then(([u, d]) => {
        setUsers(u.data.data.filter((x) => x.role !== 'INTERN'));
        setDepartments(d.data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', { ...form, departmentId: form.departmentId || null, managerId: form.managerId || null });
      toast.success('Employee created');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <Link to={`/employees/${r.id}`}>{r.firstName} {r.lastName}</Link> },
    { key: 'email', header: 'Email' },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department', render: (r) => r.department?.name || '—' },
    { key: 'role', header: 'Role', render: (r) => <Badge value={r.role} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage profiles, roles and organizational hierarchy"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Employee</button>}
      />

      <div className="toolbar">
        <input className="search-input" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <DataTable columns={columns} rows={users} />}

      {showModal && (
        <Modal title="Add Employee" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>First name<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
            <label>Last name<input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
            <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Temporary password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>Designation<input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label>Department
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
