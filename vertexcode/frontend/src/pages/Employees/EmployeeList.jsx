import { useEffect, useRef, useState } from 'react';
import {
  UserPlus, Eye, Pencil, KeyRound, Trash2, RotateCcw, Mail, Phone, Upload, Download,
  Users, UserCheck, UserX, ChevronDown, ListChecks, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import TableActions from '../../components/common/TableActions';
import DropdownMenu from '../../components/common/DropdownMenu';
import DetailField from '../../components/common/DetailField';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';
import { downloadReport, downloadCsv } from '../../lib/download';

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

// Role filter options — each resolves to the exact comma-separated `role`
// list already supported by GET /users (role.split(',') -> {in: [...]}), so
// this is a pure frontend mapping, no backend change needed. Super Admin is
// deliberately folded into every option except its own, so switching the
// role filter never accidentally hides Super Admin accounts.
const ROLE_FILTER_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee', roles: ['EMPLOYEE', 'SUPER_ADMIN'] },
  { value: 'ADMIN', label: 'Admin', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { value: 'SUPER_ADMIN', label: 'Super Admin', roles: ['SUPER_ADMIN'] },
  { value: 'ALL', label: 'All', roles: EMPLOYEE_ROLES },
];

// The backend keeps the real EmploymentStatus value TERMINATED (unchanged —
// see schema.prisma) for a moved-to-Trash employee; this module's UI must
// never show that word, so every place a status renders goes through this
// display-only override. It's deliberately narrow — only TERMINATED is
// remapped, so the genuine ON_LEAVE/SUSPENDED/ALUMNI statuses still show
// their own real names, unaffected.
const displayStatus = (status) => (status === 'TERMINATED' ? 'INACTIVE' : status);

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
  // Default scope is "Employee" (Employee + Super Admin) — Admin accounts are
  // opt-in via the role filter, never shown by default.
  const [roleFilter, setRoleFilter] = useState('EMPLOYEE');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  // Status scope (Active/Inactive/All) and Trash are two independent axes,
  // kept as separate state so Trash can never be entangled with — or lie
  // about — whatever status filter was last selected. "Inactive" is
  // ON_LEAVE/SUSPENDED/ALUMNI — a real, distinct EmploymentStatus bucket,
  // not the same thing as Trash (TERMINATED). "All" is explicitly every
  // non-terminated status (ACTIVE,ON_LEAVE,SUSPENDED,ALUMNI) — active +
  // inactive together, but deliberately never includes TERMINATED, so Trash
  // records can never leak into the normal All list.
  const [statusScope, setStatusScope] = useState('active');
  const [trashMode, setTrashMode] = useState(false);
  // `viewTab` is the single value the rest of the page reads to decide what
  // to fetch/render — trashMode always wins, and switching it on/off never
  // touches (or forces) statusScope, so the dropdown keeps showing the
  // user's real last choice instead of a faked one.
  const viewTab = trashMode ? 'trash' : statusScope;
  const STATUS_FILTER_MAP = {
    active: 'ACTIVE',
    inactive: 'ON_LEAVE,SUSPENDED,ALUMNI',
    all: 'ACTIVE,ON_LEAVE,SUSPENDED,ALUMNI',
    trash: 'TERMINATED',
  };
  const statusFilter = STATUS_FILTER_MAP[viewTab];
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, trash: 0 });
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState(null);
  const fileInputRef = useRef(null);

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const hasActiveFilters = !!(search || roleFilter !== 'EMPLOYEE' || departmentFilter || designationFilter || viewTab !== 'active');

  const load = () => {
    setLoading(true);
    const roleParam = (ROLE_FILTER_OPTIONS.find((o) => o.value === roleFilter)?.roles || EMPLOYEE_ROLES).join(',');
    // Summary-card counts are always scoped to the full Employee module
    // (EMPLOYEE_ROLES) regardless of the role filter above, so the cards
    // stay a stable "whole module" snapshot instead of shifting whenever
    // someone changes an unrelated filter. Reuses GET /users (no new
    // backend endpoint) with limit=1 — only meta.total is needed.
    // "Inactive" here is deliberately NOT TERMINATED (that's Trash) — it's
    // ON_LEAVE/SUSPENDED/ALUMNI, statuses this module's UI never sets today,
    // so it will typically read 0, which is correct, not a bug.
    const countCall = (status) => api.get('/users', { params: { role: EMPLOYEE_ROLES.join(','), status, limit: 1 } });

    // allSettled (not all) so one failing call — e.g. a transient 429/500 —
    // doesn't blank the whole page; each slice of state only updates from a
    // call that actually succeeded, and any failure is surfaced via toast.
    Promise.allSettled([
      api.get('/users', {
        params: {
          role: roleParam,
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
      countCall('ACTIVE'),
      countCall('ON_LEAVE,SUSPENDED,ALUMNI'),
      countCall('TERMINATED'),
    ])
      .then(([u, d, des, loc, et, all, activeCount, inactiveCount, trashCount]) => {
        if (u.status === 'fulfilled') {
          setUsers(u.value.data.data);
          setMeta(u.value.data.meta || null);
          // Selection is scoped to whatever's currently on screen — a stale
          // id from a previous tab/page/filter must never linger selected.
          setSelectedIds(new Set());
        }
        if (d.status === 'fulfilled') setDepartments(d.value.data.data);
        if (des.status === 'fulfilled') setDesignations(des.value.data.data.filter((x) => x.active));
        if (loc.status === 'fulfilled') setLocations(loc.value.data.data.filter((x) => x.active));
        if (et.status === 'fulfilled') setEmploymentTypes(et.value.data.data.filter((x) => x.active));
        if (all.status === 'fulfilled') setManagers(all.value.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
        // Each card updates independently from whichever count call actually
        // succeeded — a single transient failure (e.g. a 429) must not zero
        // out the other two cards along with it.
        setSummary((prev) => {
          const active = activeCount.status === 'fulfilled' ? (activeCount.value.data.meta?.total ?? 0) : prev.active;
          const inactive = inactiveCount.status === 'fulfilled' ? (inactiveCount.value.data.meta?.total ?? 0) : prev.inactive;
          const trash = trashCount.status === 'fulfilled' ? (trashCount.value.data.meta?.total ?? 0) : prev.trash;
          return { total: active + inactive + trash, active, inactive, trash };
        });

        const failed = [u, d, des, loc, et, all, activeCount, inactiveCount, trashCount].find((r) => r.status === 'rejected');
        if (failed) {
          const status = failed.reason?.response?.status;
          const message = status === 429
            ? 'Too many requests right now — some data may be out of date. Please wait a moment and refresh.'
            : (failed.reason?.response?.data?.message || 'Some employee data failed to load — showing partial results.');
          toast.error(message);
        }
      })
      .finally(() => setLoading(false));
  };

  // Any change to search/filters returns to page 1; page changes alone
  // (via Pagination's onPageChange -> setPage) leave the filters untouched.
  useEffect(() => { setPage(1); }, [search, roleFilter, departmentFilter, designationFilter, statusScope, trashMode]);
  useEffect(load, [search, roleFilter, departmentFilter, designationFilter, statusScope, trashMode, page]);

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('EMPLOYEE');
    setDepartmentFilter('');
    setDesignationFilter('');
    setStatusScope('active');
    setTrashMode(false);
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
        // Only send `role` when it actually changed from the target's
        // current value. The backend's "Admins cannot assign the Admin
        // role" guard (user.controller.js updateUser) fires on data.role
        // === 'ADMIN' alone, with no comparison to the existing role — so
        // resending an unchanged role: 'ADMIN' on every save would 403 an
        // Admin out of editing any OTHER field on an Admin peer's profile.
        role: editForm.role === editingUser.role ? undefined : editForm.role,
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

  // Irreversible — DELETE /users/:id/permanent (Super Admin only, requires
  // the account already be in Trash) permanently deletes the entire
  // account, not a re-run of Move to Trash. Only ever reachable from the
  // Trash view, so it can never affect an active employee. If this employee
  // is still referenced elsewhere (a task they created, a timesheet they
  // approved, someone they manage, a department they head, etc.) the
  // backend rejects the delete with a clear error instead of silently
  // discarding those references — same pattern as Interns' permanent delete.
  const handlePermanentlyDeleteUser = async (target) => {
    if (!window.confirm(`Permanently delete ${target.firstName} ${target.lastName}? This will remove their entire account and history. This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${target.id}/permanent`);
      toast.success('Employee permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete employee');
    }
  };

  // Bulk action built on the same single-record DELETE endpoint the row-level
  // Delete action uses — there is no separate bulk-delete API, so this just
  // fires it once per selected row (no new backend surface).
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected employee(s)? Their accounts will be deactivated and moved to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/users/${id}`)));
      toast.success(`${ids.length} employee(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected employees');
    } finally {
      setSelectedIds(new Set());
      load();
    }
  };

  // Client-side CSV of the rows already loaded on screen — the server's
  // /reports/employees endpoint exports the whole module with no id
  // filtering (see report.controller.js's exportEmployees), so scoping an
  // export to just the current selection would need a backend change;
  // building the CSV from data the page already has avoids that entirely.
  const handleExportSelected = () => {
    const rows = users.filter((u) => selectedIds.has(u.id));
    downloadCsv('employees-selected.csv', rows, [
      { key: 'employeeCode', header: 'ID' },
      { key: 'firstName', header: 'First Name' },
      { key: 'lastName', header: 'Last Name' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role' },
      { key: 'designation', header: 'Designation' },
      { key: 'department.name', header: 'Department' },
      { key: 'status', header: 'Status' },
    ]);
    toast.success(`Exported ${rows.length} employee(s)`);
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Only rows a Super Admin could actually delete are selectable (mirrors
  // the same `blocked` rule the row-level Delete action already uses) —
  // selecting a row with no possible bulk action would be a decorative
  // checkbox, which is exactly what's being avoided here.
  const selectableIds = users.filter((u) => u.id !== currentUser.id && !(u.role === 'SUPER_ADMIN' && !isSuperAdmin) && u.status !== 'TERMINATED').map((u) => u.id);
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = selectableIds.some((id) => selectedIds.has(id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    setImporting(true);
    setImportErrors(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/users/import', formData);
      toast.success(data.data.message || `${data.data.imported} employee(s) imported`);
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

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          className="vx-checkbox"
          aria-label="Select all visible employees"
          checked={allVisibleSelected}
          ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
          onChange={toggleSelectAllVisible}
          disabled={selectableIds.length === 0}
        />
      ),
      render: (r) => {
        const selectable = selectableIds.includes(r.id);
        return (
          <input
            type="checkbox"
            className="vx-checkbox"
            aria-label={`Select ${r.firstName} ${r.lastName}`}
            checked={selectedIds.has(r.id)}
            disabled={!selectable}
            onChange={() => toggleSelectOne(r.id)}
          />
        );
      },
    },
    { key: 'id', header: 'ID', render: (r) => r.employeeCode || '—' },
    { key: 'name', header: 'Name', render: (r) => <Link className="name-cell" to={`/employees/${r.id}`}>{r.firstName} {r.lastName}</Link> },
    { key: 'designation', header: 'Designation' },
    { key: 'role', header: 'Role', render: (r) => <Badge value={r.role} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} label={displayStatus(r.status)} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => {
        // Admins can't manage a Super Admin; nobody manages themselves from this list
        // (that's what /profile is for) — same rule already used before.
        const blocked = r.id === currentUser.id || (r.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN');
        const isTerminated = r.status === 'TERMINATED';
        return (
          <div className="row-actions-cell">
            <TableActions
              actions={[
                { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingUser(r) },
                !blocked && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
              ]}
            />
            <DropdownMenu
              label={`More actions for ${r.firstName} ${r.lastName}`}
              items={[
                !blocked && { key: 'account', icon: KeyRound, label: 'Reset Password', onClick: () => openManageAccount(r) },
                // Restore (status -> ACTIVE) is allowed for Admin too — see
                // user.controller.js updateUser: "an Admin may still set
                // other status values (e.g. ON_LEAVE, or ACTIVE to restore)
                // on accounts they manage." Only the actual deactivate/
                // terminate path is Super-Admin-only (DELETE /users/:id,
                // hard-gated at the route level) — Move to Trash stays
                // isSuperAdmin-only below to match that.
                !blocked && isTerminated && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => restoreUser(r) },
                isSuperAdmin && !blocked && !isTerminated && { key: 'trash', icon: Trash2, label: 'Move to Trash', danger: true, onClick: () => softDeleteUser(r) },
              ]}
            />
          </div>
        );
      },
    },
  ];

  // Trash gets its own, deliberately narrower column set — no Edit/Manage
  // Account on an already-terminated record, just enough to identify who it
  // is, restore them, or (Super Admin only) permanently delete them.
  const trashColumns = [
    { key: 'name', header: 'Name', render: (r) => <Link className="name-cell" to={`/employees/${r.id}`}>{r.firstName} {r.lastName}</Link> },
    { key: 'id', header: 'Employee ID', render: (r) => r.employeeCode || '—' },
    { key: 'designation', header: 'Designation' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} label={displayStatus(r.status)} /> },
    { key: 'exitDate', header: 'Inactive Date', render: (r) => r.exitDate ? new Date(r.exitDate).toLocaleDateString() : '—' },
    {
      key: 'actions', header: '',
      render: (r) => {
        const blocked = r.id === currentUser.id || (r.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN');
        return (
          <TableActions
            actions={[
              !blocked && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => restoreUser(r) },
              // Super-Admin-only, matching the backend route's gate exactly
              // — same Trash2 icon and confirm-then-delete style as
              // Interns → Trash's Delete Permanently.
              isSuperAdmin && !blocked && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDeleteUser(r) },
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
            {/* Import is gated server-side by the configurable can('user','create')
                permission (same as Add Employee below) — not hardcoded to Super
                Admin, so it's shown to Admin too; the backend still rejects an
                Admin importing Admin-role rows regardless (see
                user.controller.js importEmployees). If the permission isn't
                granted for this Admin, the request 403s and the existing
                error toast in handleImportFile surfaces that. */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button className="btn btn-soft-blue" onClick={handleImportClick} disabled={importing}>
              <Upload size={16} strokeWidth={2.5} /> {importing ? 'Importing...' : 'Import'}
            </button>
            {/* Export is a deliberate, hard Super-Admin-only rule at the
                backend (report.routes.js: "not routed through the
                configurable Admin permission matrix... Admins cannot be
                granted this even by toggling a permission") — kept
                Super-Admin-only here to match, unlike Import above. */}
            {currentUser.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-soft-green" onClick={() => downloadReport('/reports/employees', 'employees.csv')}><Download size={16} strokeWidth={2.5} /> Export CSV</button>
                <button className="btn btn-soft-green" onClick={() => downloadReport('/reports/employees?format=xlsx', 'employees.xlsx')}><Download size={16} strokeWidth={2.5} /> Export Excel</button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><UserPlus size={16} strokeWidth={2.5} /> Add Employee</button>
          </>
        )}
      />

      <div className="stat-grid">
        <StatCard label="Total Employees" value={summary.total} accent="blue" icon={Users} />
        <StatCard label="Active" value={summary.active} accent="green" icon={UserCheck} />
        <StatCard label="Inactive" value={summary.inactive} accent="amber" icon={UserX} />
        <StatCard label="Trash" value={summary.trash} accent="red" icon={Trash2} />
      </div>

      {/* Single compact toolbar row, shared pattern: filters flow left to
          right (wrapping as a block if the viewport is too narrow), Trash
          is wrapped in .toolbar-actions so it always stays pinned to the
          far right of the row — never between filters, never orphaned. */}
      <div className="toolbar">
        <input className="search-input" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
          {ROLE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} aria-label="Filter by designation">
          <option value="">All designations</option>
          {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select
          value={statusScope}
          onChange={(e) => setStatusScope(e.target.value)}
          disabled={trashMode}
          title={trashMode ? 'Status filter does not apply to Trash' : undefined}
          aria-label="Filter by status"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={16} strokeWidth={2.5} /> Clear Filters</button>
        )}
        <div className="toolbar-actions">
          <button type="button" className={`tab ${trashMode ? 'active' : ''}`} onClick={() => setTrashMode((t) => !t)}>
            🗑️ Trash{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}
          </button>
        </div>
      </div>

      {/* Compact bulk-action bar — appears only once something is selected,
          leaving the filter toolbar above completely unchanged otherwise.
          Count + Bulk Actions on the left, Clear pinned far right via the
          same .toolbar-actions pattern used for Trash elsewhere on this page. */}
      {viewTab !== 'trash' && selectedIds.size > 0 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            ✓ {selectedIds.size} selected
          </span>
          <DropdownMenu
            label="Bulk Actions"
            align="start"
            triggerClassName="btn btn-secondary btn-sm"
            triggerContent={<><ListChecks size={16} strokeWidth={2.5} /> Bulk Actions <ChevronDown size={16} strokeWidth={2.5} /></>}
            items={[
              { key: 'export', icon: Download, label: 'Export Selected', onClick: handleExportSelected },
              // Bulk delete loops the same DELETE /users/:id endpoint the
              // row-level action uses, which is hard Super-Admin-only at
              // the route level (see user.routes.js) — kept gated here too.
              isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Move to Trash', danger: true, onClick: handleBulkDelete },
            ]}
          />
          <div className="toolbar-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}><X size={16} strokeWidth={2.5} /> Clear</button>
          </div>
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          <DataTable columns={viewTab === 'trash' ? trashColumns : columns} rows={users} emptyMessage={viewTab === 'trash' ? 'No employees in Trash.' : undefined} />
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
              <Badge value={viewingUser.status} label={displayStatus(viewingUser.status)} />
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
                {/* Always rendered so the select shows correctly when this
                    is already the target's role; disabled as a *new*
                    choice for non-Super-Admins — matches the backend's
                    "Admins cannot assign the Admin role" rule (and the Add
                    Employee form's already-correct, stricter treatment). */}
                <option value="ADMIN" disabled={!isSuperAdmin && editingUser.role !== 'ADMIN'}>Admin</option>
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

      {importErrors && (
        <Modal size="wide" title={`Import failed — ${importErrors.length} row(s) had errors`} onClose={() => setImportErrors(null)}>
          <p className="empty-state" style={{ padding: 0, textAlign: 'left', marginBottom: 12 }}>
            Nothing was imported — fix these rows in your CSV and try again.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Row</th><th>Email</th><th>Errors</th></tr>
              </thead>
              <tbody>
                {importErrors.map((e) => (
                  <tr key={e.row}>
                    <td>{e.row}</td>
                    <td>{e.email || '—'}</td>
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
