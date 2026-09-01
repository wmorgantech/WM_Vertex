import { useEffect, useState } from 'react';
import { Plus, Eye, Pencil, KeyRound, Trash2, RotateCcw } from 'lucide-react';
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

  const [managingAccount, setManagingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ password: '', confirm: '', mustChangePassword: true });
  const [savingAccount, setSavingAccount] = useState(false);

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

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

  const openManageAccount = (target) => {
    setAccountForm({ password: '', confirm: '', mustChangePassword: true });
    setManagingAccount(target);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (accountForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (accountForm.password !== accountForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingAccount(true);
    try {
      await api.put(`/users/${managingAccount.id}`, {
        password: accountForm.password,
        mustChangePassword: accountForm.mustChangePassword,
      });
      toast.success('Password set');
      setManagingAccount(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set password');
    } finally {
      setSavingAccount(false);
    }
  };

  const softDeleteUser = async (target) => {
    if (!window.confirm(`Remove ${target.firstName} ${target.lastName}? Their account will be deactivated and the record kept for history — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/users/${target.id}`);
      toast.success('Employee removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove employee');
    }
  };

  const restoreUser = async (target) => {
    try {
      await api.put(`/users/${target.id}`, { status: 'ACTIVE', exitDate: null });
      toast.success('Employee restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore employee');
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
      key: 'actions', header: 'Actions',
      render: (r) => {
        // Admins can't manage a Super Admin; nobody manages themselves from this list
        // (that's what /profile is for) — same rule already used for status toggling.
        const blocked = r.id === currentUser.id || (r.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN');
        const isTerminated = r.status === 'TERMINATED';
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <Link to={`/employees/${r.id}`} className="btn btn-ghost btn-sm btn-icon" aria-label="View">
              <Eye size={14} />
            </Link>
            {!blocked && (
              <Link to={`/employees/${r.id}?edit=1`} className="btn btn-ghost btn-sm btn-icon" aria-label="Edit">
                <Pencil size={14} />
              </Link>
            )}
            {!blocked && (
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openManageAccount(r)} aria-label="Manage Account">
                <KeyRound size={14} />
              </button>
            )}
            {!blocked && !isTerminated && (
              <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(r)}>
                {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            )}
            {isSuperAdmin && !blocked && (
              isTerminated ? (
                <button className="btn btn-ghost btn-sm" onClick={() => restoreUser(r)}>
                  <RotateCcw size={14} /> Restore
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => softDeleteUser(r)} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              )
            )}
          </div>
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

      {managingAccount && (
        <Modal title={`Manage Account — ${managingAccount.firstName} ${managingAccount.lastName}`} onClose={() => setManagingAccount(null)}>
          <form className="form-grid" onSubmit={handleSaveAccount}>
            <label>New Password<input type="password" autoComplete="new-password" minLength={8} required value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} /></label>
            <label>Confirm Password<input type="password" autoComplete="new-password" minLength={8} required value={accountForm.confirm} onChange={(e) => setAccountForm({ ...accountForm, confirm: e.target.value })} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={accountForm.mustChangePassword} onChange={(e) => setAccountForm({ ...accountForm, mustChangePassword: e.target.checked })} />
              Require password change on next login
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setManagingAccount(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingAccount}>{savingAccount ? 'Saving...' : 'Set Password'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
