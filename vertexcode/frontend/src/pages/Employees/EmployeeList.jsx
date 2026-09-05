import { useEffect, useState } from 'react';
import { Plus, Eye, Pencil, KeyRound, Trash2, RotateCcw, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
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

const emptyForm = {
  email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE',
  designation: '', employmentType: 'FULL_TIME', departmentId: '', managerId: '', locationId: '',
};

const listToText = (arr) => (arr || []).join(', ');
const textToList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

const buildEditForm = (u) => ({
  firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '',
  role: u.role, designation: u.designation || '', employmentType: u.employmentType,
  departmentId: u.departmentId || '', locationId: u.locationId || '', managerId: u.managerId || '',
  joinDate: u.joinDate ? u.joinDate.slice(0, 10) : '',
  gender: u.gender || '', dateOfBirth: u.dateOfBirth ? u.dateOfBirth.slice(0, 10) : '',
  address: u.address || '', experienceYears: u.experienceYears ?? '',
  skills: listToText(u.skills), technologyStack: listToText(u.technologyStack), certifications: listToText(u.certifications),
});

const PAGE_SIZE = 25;
// The Employees page only ever shows Employee/Admin/Super Admin accounts —
// Interns and Trainees have their own dedicated modules. Sent as the
// baseline `role` filter (backend accepts a comma-separated list) so
// exclusion happens server-side and pagination totals stay correct.
const EMPLOYEE_ROLES = ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'];
const ROLE_LABELS = { EMPLOYEE: 'Employee', ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin' };

export default function EmployeeList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  // Default view is ACTIVE-only; "All Statuses" (empty value) is the escape
  // hatch that keeps inactive/terminated employees reachable for Restore —
  // same underlying data as before, just no longer shown by default.
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [managingAccount, setManagingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ password: '', confirm: '', mustChangePassword: true });
  const [savingAccount, setSavingAccount] = useState(false);

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const hasActiveFilters = !!(search || roleFilter || departmentFilter || designationFilter || statusFilter !== 'ACTIVE');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/users', {
        params: {
          role: roleFilter || EMPLOYEE_ROLES.join(','),
          departmentId: departmentFilter || undefined,
          designation: designationFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        },
      }),
      api.get('/departments'),
      api.get('/masters/designations'),
      api.get('/masters/locations'),
      api.get('/masters/employment-types'),
      api.get('/users'),
    ])
      .then(([u, d, des, loc, et, all]) => {
        setUsers(u.data.data);
        setMeta(u.data.meta || null);
        setDepartments(d.data.data);
        setDesignations(des.data.data.filter((x) => x.active));
        setLocations(loc.data.data.filter((x) => x.active));
        setEmploymentTypes(et.data.data.filter((x) => x.active));
        setManagers(all.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
      })
      .finally(() => setLoading(false));
  };

  // Any change to search/filters returns to page 1; page changes alone
  // (via Pagination's onPageChange -> setPage) leave the filters untouched.
  useEffect(() => { setPage(1); }, [search, roleFilter, departmentFilter, designationFilter, statusFilter]);
  useEffect(load, [search, roleFilter, departmentFilter, designationFilter, statusFilter, page]);

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setDepartmentFilter('');
    setDesignationFilter('');
    setStatusFilter('ACTIVE');
  };

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

  const openEdit = (target) => {
    setEditForm(buildEditForm(target));
    setEditingUser(target);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api.put(`/users/${editingUser.id}`, {
        ...editForm,
        designation: editForm.designation || null,
        departmentId: editForm.departmentId || null,
        locationId: editForm.locationId || null,
        managerId: editForm.managerId || null,
        joinDate: editForm.joinDate || null,
        dateOfBirth: editForm.dateOfBirth || null,
        experienceYears: editForm.experienceYears === '' ? null : Number(editForm.experienceYears),
        skills: textToList(editForm.skills),
        technologyStack: textToList(editForm.technologyStack),
        certifications: textToList(editForm.certifications),
      });
      toast.success('Employee updated');
      setEditingUser(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee');
    } finally {
      setSavingEdit(false);
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
    { key: 'id', header: 'ID', render: (r) => r.employeeCode || '—' },
    { key: 'name', header: 'Name', render: (r) => <Link className="name-cell" to={`/employees/${r.id}`}>{r.firstName} {r.lastName}</Link> },
    { key: 'designation', header: 'Designation' },
    { key: 'role', header: 'Role', render: (r) => <Badge value={r.role} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => {
        // Admins can't manage a Super Admin; nobody manages themselves from this list
        // (that's what /profile is for) — same rule already used before.
        const blocked = r.id === currentUser.id || (r.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN');
        const isTerminated = r.status === 'TERMINATED';
        return (
          <TableActions
            actions={[
              { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingUser(r) },
              !blocked && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
              !blocked && { key: 'account', icon: KeyRound, label: 'Manage Account', onClick: () => openManageAccount(r) },
              isSuperAdmin && !blocked && isTerminated && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => restoreUser(r) },
              isSuperAdmin && !blocked && !isTerminated && { key: 'trash', icon: Trash2, label: 'Delete (soft-delete)', danger: true, onClick: () => softDeleteUser(r) },
            ]}
          />
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
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} aria-label="Filter by designation">
          <option value="">All designations</option>
          {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="ACTIVE">Active</option>
          <option value="">All Statuses</option>
        </select>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear Filters</button>
        )}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          <DataTable columns={columns} rows={users} />
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}

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
                {isSuperAdmin && <option value="ADMIN">Admin</option>}
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

      {viewingUser && (
        <Modal size="wide" title={`${viewingUser.firstName} ${viewingUser.lastName}`} onClose={() => setViewingUser(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <span className="detail-field-value">{viewingUser.employeeCode}</span>
              <Badge value={viewingUser.role} />
              <Badge value={viewingUser.status} />
            </div>

            <div className="detail-section">
              <p className="detail-section-title">Contact</p>
              <div className="detail-grid">
                <DetailField icon={Mail} label="Email" value={viewingUser.email} />
                <DetailField icon={Phone} label="Phone" value={viewingUser.phone} />
              </div>
            </div>

            <div className="detail-section">
              <p className="detail-section-title">Employment Information</p>
              <div className="detail-grid">
                <DetailField label="Designation" value={viewingUser.designation} />
                <DetailField label="Employment Type" value={viewingUser.employmentType} />
                <DetailField label="Department" value={viewingUser.department?.name} />
                <DetailField label="Location" value={viewingUser.location?.name} />
                <DetailField label="Manager" value={viewingUser.manager ? `${viewingUser.manager.firstName} ${viewingUser.manager.lastName}` : null} />
                <DetailField label="Join Date" value={viewingUser.joinDate ? new Date(viewingUser.joinDate).toLocaleDateString() : null} />
              </div>
            </div>

            <div className="detail-section">
              <p className="detail-section-title">Personal Information</p>
              <div className="detail-grid">
                <DetailField label="Gender" value={viewingUser.gender} />
                <DetailField label="Date of Birth" value={viewingUser.dateOfBirth ? new Date(viewingUser.dateOfBirth).toLocaleDateString() : null} />
                <DetailField label="Experience" value={viewingUser.experienceYears != null ? `${viewingUser.experienceYears} yrs` : null} />
                <DetailField full label="Address" value={viewingUser.address} />
                <DetailField full label="Skills" value={listToText(viewingUser.skills) || null} />
                <DetailField full label="Technology Stack" value={listToText(viewingUser.technologyStack) || null} />
                <DetailField full label="Certifications" value={listToText(viewingUser.certifications) || null} />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewingUser(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editingUser && editForm && (
        <Modal title={`Edit — ${editingUser.firstName} ${editingUser.lastName}`} onClose={() => setEditingUser(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>First Name<input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} /></label>
            <label>Last Name<input required value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} /></label>
            <label>Email<input type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></label>
            <label>Phone<input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>
            <label>Role
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                disabled={!isSuperAdmin && (editingUser.role === 'SUPER_ADMIN' || editForm.role === 'SUPER_ADMIN')}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
                {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
              </select>
            </label>
            <label>Designation
              <select value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}>
                <option value="">— None —</option>
                {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <label>Employment Type
              <select value={editForm.employmentType} onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}>
                {employmentTypes.map((et) => <option key={et.code} value={et.code}>{et.label}</option>)}
              </select>
            </label>
            <label>Join Date<input type="date" required value={editForm.joinDate} onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })} /></label>
            <label>Department
              <select value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Location
              <select value={editForm.locationId} onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })}>
                <option value="">— None —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label>Manager
              <select value={editForm.managerId} onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}>
                <option value="">— None —</option>
                {managers.filter((m) => m.id !== editingUser.id).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </select>
            </label>
            <label>Gender
              <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                <option value="">— Not specified —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>Date of Birth<input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} /></label>
            <label>Experience (years)<input type="number" step="0.5" value={editForm.experienceYears} onChange={(e) => setEditForm({ ...editForm, experienceYears: e.target.value })} /></label>
            <label>Address<textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></label>
            <label>Skills (comma-separated)<input value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} /></label>
            <label>Technology Stack (comma-separated)<input value={editForm.technologyStack} onChange={(e) => setEditForm({ ...editForm, technologyStack: e.target.value })} /></label>
            <label>Certifications (comma-separated)<input value={editForm.certifications} onChange={(e) => setEditForm({ ...editForm, certifications: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingUser(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
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
