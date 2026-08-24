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
import { downloadReport } from '../../lib/download';

const emptyForm = {
  email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE',
  designation: '', employmentType: 'FULL_TIME', departmentId: '', managerId: '', locationId: '',
};

export default function EmployeeList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
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
      api.get('/masters/designations'),
      api.get('/masters/locations'),
      api.get('/masters/employment-types'),
    ])
      .then(([u, d, des, loc, et]) => {
        setUsers(u.data.data.filter((x) => x.role !== 'INTERN' && x.role !== 'TRAINEE'));
        setDepartments(d.data.data);
        setDesignations(des.data.data.filter((x) => x.active));
        setLocations(loc.data.data.filter((x) => x.active));
        setEmploymentTypes(et.data.data.filter((x) => x.active));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', {
        ...form,
        designation: form.designation || null,
        departmentId: form.departmentId || null,
        managerId: form.managerId || null,
        locationId: form.locationId || null,
      });
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

  const toggleStatus = async (target) => {
    const nextStatus = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.put(`/users/${target.id}`, { status: nextStatus });
      toast.success(nextStatus === 'ACTIVE' ? 'Account activated' : 'Account deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <Link to={`/employees/${r.id}`}>{r.firstName} {r.lastName}</Link> },
    { key: 'email', header: 'Email' },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department', render: (r) => r.department?.name || '—' },
    { key: 'location', header: 'Location', render: (r) => r.location?.name || '—' },
    { key: 'role', header: 'Role', render: (r) => <Badge value={r.role} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'activation', header: '',
      render: (r) => {
        // Admins can't deactivate a Super Admin; nobody deactivates themselves from this list.
        const blocked = r.id === currentUser.id || (r.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN');
        if (blocked) return null;
        return (
          <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(r)}>
            {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage profiles, roles and organizational hierarchy"
        actions={(
          <>
            {currentUser.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/employees', 'employees.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/employees?format=xlsx', 'employees.xlsx')}>Export Excel</button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Employee</button>
          </>
        )}
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
            <label>Designation
              <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                <option value="">— None —</option>
                {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label>Employment Type
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                {employmentTypes.map((et) => <option key={et.code} value={et.code}>{et.label}</option>)}
              </select>
            </label>
            <label>Department
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Location
              <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                <option value="">— None —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
