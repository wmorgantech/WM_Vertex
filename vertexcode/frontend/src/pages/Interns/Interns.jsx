import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Eye, Mail, RotateCcw, GraduationCap, UserCheck, UserX, Download, UserPlus } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import SearchableSelect from '../../components/common/SearchableSelect';
import CustomFieldsSection from '../../components/common/CustomFieldsSection';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

// TERMINATED is deliberately excluded here — it's reserved for the
// dedicated Delete/Restore (Trash) flow, never a value an Edit form can set
// directly (see backend intern.controller.js updateEnrollment's guard).
const EDITABLE_COMPLETION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'EXTENDED', 'CONVERTED_TO_EMPLOYEE'];
const BATCH_STATUSES = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'Job Oriented Training (JOT)' };
const PAGE_SIZE = 25;

// Active/Inactive/All/Trash — mirrors the Employees page's viewTab pattern
// (EmployeeList.jsx), extended with a second axis specific to interns:
// - accountStatus (User.status) is the Active-vs-Trash axis: TERMINATED
//   here means soft-deleted, exactly like Employees.
// - completionStatus (InternEnrollment.completionStatus) is the
//   Active-vs-Inactive axis within non-deleted interns: IN_PROGRESS is
//   "Active", a finished/extended/converted program is "Inactive" but the
//   account is still on record, not deleted.
// TERMINATED is never part of the Inactive bucket on either axis — it is
// exclusively how Trash is defined. Kept in sync end-to-end with the
// backend's listEnrollments/deleteEnrollment/restoreEnrollment.
//
// "All" previously sent accountStatus: undefined — the backend's
// listEnrollments only filters on user.status when accountStatus is
// present, so an unset value meant NO status filter at all, silently
// including TERMINATED (Trash) rows in the normal All list. Fixed to
// accountStatus: 'ACTIVE' (with completionStatus left unfiltered), which
// correctly means "every non-deleted completion status" — active + inactive
// together, Trash excluded.
const VIEW_TABS = [
  { value: 'active', label: 'Active', scope: { accountStatus: 'ACTIVE', completionStatus: 'IN_PROGRESS' } },
  { value: 'inactive', label: 'Inactive', scope: { accountStatus: 'ACTIVE', completionStatus: 'COMPLETED,EXTENDED,CONVERTED_TO_EMPLOYEE' } },
  { value: 'all', label: 'All', scope: { accountStatus: 'ACTIVE', completionStatus: undefined } },
  { value: 'trash', label: '🗑️ Trash', scope: { accountStatus: 'TERMINATED', completionStatus: undefined } },
];

// The backend keeps the real status value TERMINATED (unchanged — both
// User.status and InternEnrollment.completionStatus use it for Trash) so
// existing filtering/restore/permanent-delete logic is untouched; this
// module's UI must never show that word, so every place a status renders
// goes through this display-only override. Deliberately narrow — only
// TERMINATED is remapped, so the genuine Inactive bucket
// (COMPLETED/EXTENDED/CONVERTED_TO_EMPLOYEE, or Employees'
// ON_LEAVE/SUSPENDED/ALUMNI) still shows its own real name, unaffected.
// Same convention as EmployeeList.jsx, so "Inactive" reads identically
// across both modules.
const displayStatus = (status) => (status === 'TERMINATED' ? 'INACTIVE' : status);

export default function Interns() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [viewingEnrollment, setViewingEnrollment] = useState(null);

  const [tab, setTab] = useState('enrollments');
  const [viewTab, setViewTab] = useState('active');
  const [enrollments, setEnrollments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [enrollableInterns, setEnrollableInterns] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [mentorFilter, setMentorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, trash: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showNewInternModal, setShowNewInternModal] = useState(false);
  const [batchForm, setBatchForm] = useState({ name: '', program: '', startDate: '', endDate: '', description: '' });
  const [enrollForm, setEnrollForm] = useState({ userId: '', batchId: '', mentorId: '' });
  const emptyNewInternForm = { email: '', password: '', firstName: '', lastName: '', phone: '', designation: '' };
  const [newInternForm, setNewInternForm] = useState(emptyNewInternForm);
  const [savingNewIntern, setSavingNewIntern] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState(null);
  const [enrollEditForm, setEnrollEditForm] = useState({});
  const [profileEditForm, setProfileEditForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchEditForm, setBatchEditForm] = useState({});

  // Debounced so typing in the search box doesn't re-fire all 5 parallel
  // calls below (including 3 that don't even depend on the search term) on
  // every keystroke — that burst was a major contributor to hitting the
  // API's per-IP rate limit during ordinary admin use (see app.js apiLimiter).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = () => {
    setLoading(true);
    const scope = VIEW_TABS.find((t) => t.value === viewTab).scope;
    // Managers get the full user directory (for mentor assignment); everyone
    // who can enroll interns gets the scoped "not yet enrolled intern" list
    // (existing intern profiles, role=INTERN, no batch yet) regardless of role.
    const usersCall = isManager ? api.get('/users') : Promise.resolve({ data: { data: [] } });
    const enrollableCall = api.get('/interns/enrollable-users');
    const enrollmentsCall = api.get('/interns/enrollments', {
      params: {
        search: debouncedSearch || undefined,
        batchId: batchFilter || undefined,
        mentorId: mentorFilter || undefined,
        accountStatus: scope.accountStatus,
        completionStatus: scope.completionStatus,
        page,
        limit: PAGE_SIZE,
      },
    });
    // Real, live counts for the summary cards — reuses GET /interns/enrollments
    // (no new backend endpoint) with limit=1, same technique already used by
    // Employees/Trainees/Departments/Projects. Always scoped to the full
    // module regardless of the current batch/mentor/search filters, so the
    // cards stay a stable "whole module" snapshot.
    const countCall = (accountStatus, completionStatus) => api.get('/interns/enrollments', { params: { accountStatus, completionStatus, limit: 1 } });

    // allSettled (not all) so one failing call — e.g. a transient 429/500 on
    // /users — doesn't wipe out an otherwise-successful Intern List; each
    // slice of state only updates from a call that actually succeeded, and
    // any failure is surfaced instead of silently rendering an empty table.
    Promise.allSettled([
      enrollmentsCall, api.get('/interns/batches'), usersCall, enrollableCall, api.get('/masters/designations'),
      countCall(undefined, undefined),
      countCall('ACTIVE', 'IN_PROGRESS'),
      countCall('ACTIVE', 'COMPLETED,EXTENDED,CONVERTED_TO_EMPLOYEE'),
      countCall('TERMINATED', undefined),
    ])
      .then(([e, b, u, en, des, totalCount, activeCount, inactiveCount, trashCount]) => {
        if (e.status === 'fulfilled') {
          setEnrollments(e.value.data.data);
          setMeta(e.value.data.meta || null);
          // Selection is scoped to whatever's currently on screen — a stale
          // id from a previous tab/page/filter must never linger selected.
          setSelectedIds(new Set());
        }
        if (b.status === 'fulfilled') setBatches(b.value.data.data);
        if (u.status === 'fulfilled') setUsers(u.value.data.data);
        if (en.status === 'fulfilled') setEnrollableInterns(en.value.data.data);
        if (des.status === 'fulfilled') setDesignations(des.value.data.data.filter((d) => d.active));
        // Each card updates independently from whichever count call
        // succeeded, so one transient failure doesn't zero out the others.
        setSummary((prev) => ({
          total: totalCount.status === 'fulfilled' ? (totalCount.value.data.meta?.total ?? 0) : prev.total,
          active: activeCount.status === 'fulfilled' ? (activeCount.value.data.meta?.total ?? 0) : prev.active,
          inactive: inactiveCount.status === 'fulfilled' ? (inactiveCount.value.data.meta?.total ?? 0) : prev.inactive,
          trash: trashCount.status === 'fulfilled' ? (trashCount.value.data.meta?.total ?? 0) : prev.trash,
        }));

        const failed = [e, b, u, en, des, totalCount, activeCount, inactiveCount, trashCount].find((r) => r.status === 'rejected');
        if (failed) {
          const status = failed.reason?.response?.status;
          const message = status === 429
            ? 'Too many requests right now — some intern data may be out of date. Please wait a moment and refresh.'
            : (failed.reason?.response?.data?.message || 'Some intern data failed to load — showing partial results.');
          toast.error(message);
        }
      })
      .finally(() => setLoading(false));
  };
  // Filter/search/tab changes return to page 1; a bare page change (Pagination's
  // onPageChange) leaves the active filters untouched.
  useEffect(() => { setPage(1); }, [debouncedSearch, batchFilter, mentorFilter, viewTab]);
  useEffect(load, [debouncedSearch, batchFilter, mentorFilter, viewTab, page]);

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/interns/batches', batchForm);
      toast.success('Batch created');
      setShowBatchModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create batch');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateIntern = async (e) => {
    e.preventDefault();
    // Belt-and-suspenders guard: the submit button's disabled={savingNewIntern}
    // already blocks a second click in practice (React commits the state
    // update before the next click event is processed), but this checks the
    // state directly rather than relying on the DOM attribute having applied,
    // so a second invocation from any source is a no-op rather than a second POST.
    if (savingNewIntern) return;
    setSavingNewIntern(true);
    try {
      await api.post('/interns', { ...newInternForm, phone: newInternForm.phone || null, designation: newInternForm.designation || null });
      toast.success('Intern profile created');
      setShowNewInternModal(false);
      setNewInternForm(emptyNewInternForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create intern profile');
    } finally {
      setSavingNewIntern(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/interns/enrollments', enrollForm);
      toast.success('Intern enrolled');
      setShowEnrollModal(false);
      setEnrollForm({ userId: '', batchId: '', mentorId: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enroll intern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (enrollment) => {
    if (!window.confirm(`Remove ${enrollment.user.firstName} ${enrollment.user.lastName} as an intern? Their account will be deactivated and the record moved to Trash — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/interns/enrollments/${enrollment.id}`);
      toast.success('Intern moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove intern');
    }
  };

  const handleRestore = async (enrollment) => {
    try {
      await api.post(`/interns/enrollments/${enrollment.id}/restore`);
      toast.success('Intern restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore intern');
    }
  };

  // Irreversible — DELETE /interns/enrollments/:id/permanent (Super Admin
  // only, requires the intern already be in Trash) permanently deletes the
  // entire account, not a re-run of Move to Trash. Only ever reachable from
  // the Trash tab, so it can never affect an active intern. load() refreshes
  // both the Trash table and the summary cards (Total/Active/Inactive/Trash)
  // from the server afterward, the same as every other action on this page.
  const handlePermanentlyDelete = async (enrollment) => {
    if (!window.confirm(`Permanently delete ${enrollment.user.firstName} ${enrollment.user.lastName}? This will remove their entire account, documents, and history. This cannot be undone.`)) return;
    try {
      await api.delete(`/interns/enrollments/${enrollment.id}/permanent`);
      toast.success('Intern permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete intern');
    }
  };

  // Bulk action built on top of the same single-record DELETE endpoint used
  // by the row-level Delete action — there is no separate bulk-delete API,
  // so this simply fires it once per selected row (no new backend surface).
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected intern(s)? Their accounts will be deactivated and the records moved to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/interns/enrollments/${id}`)));
      toast.success(`${ids.length} intern(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected interns');
    } finally {
      setSelectedIds(new Set());
      load();
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleIds = enrollments.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const openEnrollEdit = (r) => {
    setEditingEnrollment(r);
    setEnrollEditForm({
      mentorId: r.mentor?.id || '',
      completionStatus: r.completionStatus,
      performanceRating: r.performanceRating ?? '',
      progressPercent: r.progressPercent,
      stipend: r.stipend ?? '',
      category: r.category || '',
      notes: r.notes || '',
    });
    setProfileEditForm({
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      email: r.user.email,
      phone: r.user.phone || '',
    });
  };

  const handleSaveEnrollEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/interns/enrollments/${editingEnrollment.id}`, {
        ...enrollEditForm,
        mentorId: enrollEditForm.mentorId || null,
        performanceRating: enrollEditForm.performanceRating === '' ? null : Number(enrollEditForm.performanceRating),
        progressPercent: enrollEditForm.progressPercent === '' ? 0 : Number(enrollEditForm.progressPercent),
        stipend: enrollEditForm.stipend === '' ? null : Number(enrollEditForm.stipend),
        category: enrollEditForm.category || null,
      });
      toast.success('Enrollment updated');
      setEditingEnrollment(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update enrollment');
    } finally {
      setSaving(false);
    }
  };

  // Profile fields (name/email/phone) live on the User record, not the
  // enrollment — saved separately via the same PUT /users/:id endpoint the
  // Employees page uses (reused as-is, including its existing email-
  // uniqueness check and manager-only field allowlist).
  const handleSaveProfileEdit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put(`/users/${editingEnrollment.user.id}`, profileEditForm);
      toast.success('Intern profile updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update intern profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const openBatchEdit = (b) => {
    setEditingBatch(b);
    setBatchEditForm({
      name: b.name, program: b.program,
      startDate: b.startDate.slice(0, 10), endDate: b.endDate.slice(0, 10),
      description: b.description || '', status: b.status,
    });
  };

  const handleSaveBatchEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/interns/batches/${editingBatch.id}`, batchEditForm);
      toast.success('Batch updated');
      setEditingBatch(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update batch');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBatch = async (b) => {
    if (!window.confirm(`Delete batch "${b.name}"? This cannot be undone. The batch must have no enrollments left in it.`)) return;
    try {
      await api.delete(`/interns/batches/${b.id}`);
      toast.success('Batch removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove batch');
    }
  };

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible interns"
        checked={allVisibleSelected}
        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
        onChange={toggleSelectAllVisible}
      />
    ),
    render: (r) => (
      <input
        type="checkbox"
        aria-label={`Select ${r.user.firstName} ${r.user.lastName}`}
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelectOne(r.id)}
      />
    ),
  };

  const enrollmentColumns = [
    ...(isManager ? [selectColumn] : []),
    { key: 'id', header: 'ID', render: (r) => r.user.employeeCode || '—' },
    { key: 'name', header: 'Intern', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (r) => r.batch.name },
    { key: 'mentor', header: 'Mentor', render: (r) => r.mentor ? `${r.mentor.firstName} ${r.mentor.lastName}` : '—' },
    { key: 'progressPercent', header: 'Progress', render: (r) => `${r.progressPercent}%` },
    { key: 'performanceRating', header: 'Rating', render: (r) => r.performanceRating ?? '—' },
    { key: 'completionStatus', header: 'Status', render: (r) => <Badge value={r.completionStatus} label={displayStatus(r.completionStatus)} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingEnrollment(r) },
            isManager && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEnrollEdit(r) },
            // Soft delete only (completionStatus -> TERMINATED + account
            // deactivated — see handleDelete/backend deleteEnrollment). The
            // record moves to the Trash tab, restorable from there. Gated
            // the same as Edit (isManager) — the backend enforces the same
            // intern:manage permission + per-record mentor-scoping for both
            // DELETE and PUT /interns/enrollments/:id.
            isManager && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  // Trash gets its own, deliberately narrower column set — no Edit on an
  // already-removed record, just enough to identify who it is, restore
  // them, or (Super Admin only) permanently delete them.
  const trashColumns = [
    { key: 'id', header: 'ID', render: (r) => r.user.employeeCode || '—' },
    { key: 'name', header: 'Intern', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (r) => r.batch.name },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.completionStatus} label={displayStatus(r.completionStatus)} /> },
    { key: 'exitDate', header: 'Removed Date', render: (r) => r.user.exitDate ? new Date(r.user.exitDate).toLocaleDateString() : '—' },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingEnrollment(r) },
            isManager && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
            // Super-Admin-only, matching the backend route's gate exactly
            // (stricter than Restore's mentor-scoped isManager) — same
            // Trash2 icon used for every destructive action across the app.
            isSuperAdmin && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDelete(r) },
          ]}
        />
      ),
    },
  ];

  const batchColumns = [
    { key: 'name', header: 'Batch' },
    { key: 'program', header: 'Program' },
    { key: 'startDate', header: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', header: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'count', header: 'Interns', render: (r) => r._count?.enrollments ?? 0 },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            isManager && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openBatchEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete batch', danger: true, onClick: () => handleDeleteBatch(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Intern Management"
        subtitle="Internship batches, mentor assignment and progress tracking"
        actions={(
          <>
            {/* Contextual per tab: Intern List gets the full action set,
                Enroll Batch only gets the two batch-related actions —
                Export/New Intern don't apply to a screen with no enrollment
                list on it. */}
            {tab === 'enrollments' && isSuperAdmin && (
              <>
                <button className="btn btn-soft-blue" onClick={() => downloadReport('/reports/interns', 'interns.csv')}><Download size={16} strokeWidth={2.5} /> Export CSV</button>
                <button className="btn btn-soft-green" onClick={() => downloadReport('/reports/interns?format=xlsx', 'interns.xlsx')}><Download size={16} strokeWidth={2.5} /> Export Excel</button>
              </>
            )}
            {isManager && <button className="btn btn-soft-purple" onClick={() => setShowBatchModal(true)}><Plus size={16} strokeWidth={2.5} /> New Batch</button>}
            <button className="btn btn-soft-purple" onClick={() => setShowEnrollModal(true)}><UserCheck size={16} strokeWidth={2.5} /> Enroll to Batch</button>
            {tab === 'enrollments' && (
              <button className="btn btn-primary" onClick={() => setShowNewInternModal(true)}><UserPlus size={16} strokeWidth={2.5} /> New Intern</button>
            )}
          </>
        )}
      />

      {tab === 'enrollments' && (
        <div className="stat-grid">
          <StatCard label="Total Interns" value={summary.total} accent="blue" icon={GraduationCap} />
          <StatCard label="Active" value={summary.active} accent="green" icon={UserCheck} />
          <StatCard label="Inactive" value={summary.inactive} accent="amber" icon={UserX} />
          <StatCard label="Trash" value={summary.trash} accent="red" icon={Trash2} />
        </div>
      )}

      {/* Single compact toolbar row, shared pattern: main tabs, then
          filters flowing left to right, then Trash pinned to the far right
          via .toolbar-actions (never between filters, never orphaned mid-row). */}
      <div className="toolbar">
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`tab ${tab === 'enrollments' ? 'active' : ''}`} onClick={() => setTab('enrollments')}>Intern List</button>
          {isManager && <button className={`tab ${tab === 'batches' ? 'active' : ''}`} onClick={() => setTab('batches')}>Enroll Batch</button>}
        </div>

        {tab === 'enrollments' && (
          <>
            <select value={viewTab === 'trash' ? 'active' : viewTab} onChange={(e) => setViewTab(e.target.value)} aria-label="Filter by status">
              {VIEW_TABS.filter((t) => t.value !== 'trash').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="search-input" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} aria-label="Filter by batch">
              <option value="">All batches</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {isManager && (
              <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)} aria-label="Filter by mentor">
                <option value="">All mentors</option>
                {users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            )}
            <div className="toolbar-actions">
              <button type="button" className={`tab ${viewTab === 'trash' ? 'active' : ''}`} onClick={() => setViewTab('trash')}>🗑️ Trash <Badge value="TERMINATED" label={String(summary.trash)} /></button>
            </div>
          </>
        )}
      </div>

      {tab === 'enrollments' && isManager && viewTab !== 'trash' && selectedIds.size > 0 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <span>{selectedIds.size} selected</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={14} /> Delete Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        tab === 'enrollments' ? (
          <>
            {viewTab === 'active' && enrollableInterns.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p className="detail-section-title">Not Yet Enrolled ({enrollableInterns.length})</p>
                <p className="empty-state" style={{ padding: 0, textAlign: 'left', marginBottom: 8 }}>
                  These intern profiles have been created but not yet assigned to a batch — use Enroll to add them below.
                </p>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
                    { key: 'email', header: 'Email' },
                    {
                      key: 'actions', header: '', render: (r) => (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEnrollForm({ userId: r.id, batchId: '', mentorId: '' }); setShowEnrollModal(true); }}
                        >
                          Enroll
                        </button>
                      ),
                    },
                  ]}
                  rows={enrollableInterns}
                />
              </div>
            )}
            <DataTable
              columns={viewTab === 'trash' ? trashColumns : enrollmentColumns}
              rows={enrollments}
              emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No interns found.'}
            />
            <Pagination meta={meta} onPageChange={setPage} />
          </>
        ) : (
          <DataTable columns={batchColumns} rows={batches} />
        )
      )}

      {showBatchModal && (
        <Modal title="New Internship Batch" onClose={() => setShowBatchModal(false)}>
          <form className="form-grid" onSubmit={handleCreateBatch}>
            <label>Name<input required value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} /></label>
            <label>Program<input required value={batchForm.program} onChange={(e) => setBatchForm({ ...batchForm, program: e.target.value })} /></label>
            <label>Start Date<input type="date" required value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} /></label>
            <label>Description<textarea value={batchForm.description} onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowBatchModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showNewInternModal && (
        <Modal title="New Intern" onClose={() => setShowNewInternModal(false)}>
          <form className="form-grid" onSubmit={handleCreateIntern}>
            <label>First name<input required value={newInternForm.firstName} onChange={(e) => setNewInternForm({ ...newInternForm, firstName: e.target.value })} /></label>
            <label>Last name<input required value={newInternForm.lastName} onChange={(e) => setNewInternForm({ ...newInternForm, lastName: e.target.value })} /></label>
            <label>Email<input type="email" required value={newInternForm.email} onChange={(e) => setNewInternForm({ ...newInternForm, email: e.target.value })} /></label>
            <label>Temporary password<input type="password" required value={newInternForm.password} onChange={(e) => setNewInternForm({ ...newInternForm, password: e.target.value })} /></label>
            <label>Phone<input value={newInternForm.phone} onChange={(e) => setNewInternForm({ ...newInternForm, phone: e.target.value })} /></label>
            <label>Designation
              <select value={newInternForm.designation} onChange={(e) => setNewInternForm({ ...newInternForm, designation: e.target.value })}>
                <option value="">— None —</option>
                {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <p className="empty-state" style={{ padding: 0, textAlign: 'left', marginTop: -4 }}>
              This only creates the intern's profile. Use "Enroll to Batch" afterward to assign them to a batch.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowNewInternModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingNewIntern}>{savingNewIntern ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showEnrollModal && (
        <Modal title="Enroll Intern into Batch" onClose={() => setShowEnrollModal(false)}>
          <form className="form-grid" onSubmit={handleEnroll}>
            <label>Intern
              <SearchableSelect
                options={enrollableInterns.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}`, sublabel: u.email }))}
                value={enrollForm.userId}
                onChange={(val) => setEnrollForm({ ...enrollForm, userId: val })}
                placeholder="Search by name or email..."
              />
            </label>
            <label>Batch
              <select required value={enrollForm.batchId} onChange={(e) => setEnrollForm({ ...enrollForm, batchId: e.target.value })}>
                <option value="">Select batch...</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {isManager && (
              <label>Mentor
                <select value={enrollForm.mentorId} onChange={(e) => setEnrollForm({ ...enrollForm, mentorId: e.target.value })}>
                  <option value="">— None (defaults to you) —</option>
                  {users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </label>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowEnrollModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Enroll'}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewingEnrollment && (
        <Modal size="wide" title={`${viewingEnrollment.user.firstName} ${viewingEnrollment.user.lastName}`} onClose={() => setViewingEnrollment(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <span className="detail-field-value">{viewingEnrollment.user.employeeCode}</span>
              <Badge value={viewingEnrollment.completionStatus} label={displayStatus(viewingEnrollment.completionStatus)} />
              <Badge value={viewingEnrollment.user.status} label={displayStatus(viewingEnrollment.user.status)} />
              {viewingEnrollment.category && <Badge value={viewingEnrollment.category} label={CATEGORY_LABELS[viewingEnrollment.category]} />}
            </div>
            <div className="detail-grid">
              <DetailField icon={Mail} label="Email" value={viewingEnrollment.user.email} />
              <DetailField label="Batch" value={viewingEnrollment.batch?.name} />
              <DetailField label="Mentor" value={viewingEnrollment.mentor ? `${viewingEnrollment.mentor.firstName} ${viewingEnrollment.mentor.lastName}` : null} />
              <DetailField label="Progress" value={`${viewingEnrollment.progressPercent ?? 0}%`} />
              <DetailField label="Performance Rating" value={viewingEnrollment.performanceRating ?? null} />
              <DetailField label="Stipend" value={viewingEnrollment.stipend != null ? `₹${viewingEnrollment.stipend.toLocaleString()}` : null} />
              <DetailField full label="Notes" value={viewingEnrollment.notes} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewingEnrollment(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editingEnrollment && (
        <Modal title={`Edit Intern — ${editingEnrollment.user.firstName} ${editingEnrollment.user.lastName}`} onClose={() => setEditingEnrollment(null)}>
          <p className="detail-section-title">Profile</p>
          <form className="form-grid" onSubmit={handleSaveProfileEdit}>
            <label>First name<input required value={profileEditForm.firstName} onChange={(e) => setProfileEditForm({ ...profileEditForm, firstName: e.target.value })} /></label>
            <label>Last name<input required value={profileEditForm.lastName} onChange={(e) => setProfileEditForm({ ...profileEditForm, lastName: e.target.value })} /></label>
            <label>Email<input type="email" required value={profileEditForm.email} onChange={(e) => setProfileEditForm({ ...profileEditForm, email: e.target.value })} /></label>
            <label>Phone<input value={profileEditForm.phone} onChange={(e) => setProfileEditForm({ ...profileEditForm, phone: e.target.value })} /></label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </form>
          <p className="detail-section-title">Enrollment</p>
          <form className="form-grid" onSubmit={handleSaveEnrollEdit}>
            <label>Mentor
              <select value={enrollEditForm.mentorId} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Completion Status
              <select value={enrollEditForm.completionStatus} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, completionStatus: e.target.value })}>
                {EDITABLE_COMPLETION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Performance Rating<input type="number" step="0.1" min="0" max="5" value={enrollEditForm.performanceRating} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, performanceRating: e.target.value })} /></label>
            <label>Progress %<input type="number" min="0" max="100" value={enrollEditForm.progressPercent} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, progressPercent: e.target.value })} /></label>
            <label>Stipend<input type="number" min="0" value={enrollEditForm.stipend} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, stipend: e.target.value })} /></label>
            <label>Category
              <select value={enrollEditForm.category} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, category: e.target.value })}>
                <option value="">— None —</option>
                <option value="FREE_INTERNSHIP">Free Internship</option>
                <option value="JOT">Job Oriented Training (JOT)</option>
              </select>
            </label>
            <label>Notes<textarea value={enrollEditForm.notes} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, notes: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingEnrollment(null)}>Close</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Enrollment'}</button>
            </div>
          </form>
          <CustomFieldsSection entityType="INTERN" entityId={editingEnrollment.user.id} />
        </Modal>
      )}

      {editingBatch && (
        <Modal title={`Edit Batch — ${editingBatch.name}`} onClose={() => setEditingBatch(null)}>
          <form className="form-grid" onSubmit={handleSaveBatchEdit}>
            <label>Name<input required value={batchEditForm.name} onChange={(e) => setBatchEditForm({ ...batchEditForm, name: e.target.value })} /></label>
            <label>Program<input required value={batchEditForm.program} onChange={(e) => setBatchEditForm({ ...batchEditForm, program: e.target.value })} /></label>
            <label>Start Date<input type="date" required value={batchEditForm.startDate} onChange={(e) => setBatchEditForm({ ...batchEditForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={batchEditForm.endDate} onChange={(e) => setBatchEditForm({ ...batchEditForm, endDate: e.target.value })} /></label>
            <label>Status
              <select value={batchEditForm.status} onChange={(e) => setBatchEditForm({ ...batchEditForm, status: e.target.value })}>
                {BATCH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Description<textarea value={batchEditForm.description} onChange={(e) => setBatchEditForm({ ...batchEditForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingBatch(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
