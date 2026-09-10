import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, Mail, RotateCcw, Upload, Download, UserPlus, Users, UserCheck, UserX, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';
import { useAuth } from '../../context/AuthContext';

const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
// TERMINATED excluded — reserved for the dedicated Delete/Restore (Trash)
// flow, never a value the Edit form can set directly (see backend
// trainee.controller.js updateEnrollment's guard, mirroring the same fix
// already applied to Interns).
const EDITABLE_COMPLETION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'EXTENDED', 'CONVERTED_TO_EMPLOYEE'];
const PAGE_SIZE = 25;

// Active/Inactive/All/Trash — same pattern as Interns (mirrors
// Interns.jsx's VIEW_TABS exactly; TraineeEnrollment.completionStatus uses
// the same InternCompletionStatus enum, see schema.prisma). "Active" is
// completionStatus=IN_PROGRESS; "Inactive" is a finished/extended/converted
// program whose account is still on record, not deleted; Trash is
// account-level (User.status=TERMINATED, which deleteEnrollment/
// restoreEnrollment always keep in sync with completionStatus=TERMINATED).
// "All" previously sent accountStatus: undefined, which — like the same bug
// already found and fixed on Interns — meant no status filter at all on the
// backend, silently including TERMINATED (Trash) rows. Fixed to
// accountStatus: 'ACTIVE' with completionStatus left unfiltered.
const VIEW_TABS = [
  { value: 'active', label: 'Active', scope: { accountStatus: 'ACTIVE', completionStatus: 'IN_PROGRESS' } },
  { value: 'inactive', label: 'Inactive', scope: { accountStatus: 'ACTIVE', completionStatus: 'COMPLETED,EXTENDED,CONVERTED_TO_EMPLOYEE' } },
  { value: 'all', label: 'All', scope: { accountStatus: 'ACTIVE', completionStatus: undefined } },
  { value: 'trash', label: '🗑️ Trash', scope: { accountStatus: 'TERMINATED', completionStatus: undefined } },
];

// The backend keeps the real status value TERMINATED (unchanged — both
// User.status and TraineeEnrollment.completionStatus use it for Trash) so
// existing filtering/restore/permanent-delete logic is untouched; this
// module's UI must never show that word, so every place a status renders
// goes through this display-only override. Deliberately narrow — only
// TERMINATED is remapped, so the genuine Inactive bucket
// (COMPLETED/EXTENDED/CONVERTED_TO_EMPLOYEE) still shows its own real name,
// unaffected. Same convention as EmployeeList.jsx/Interns.jsx, so
// "Inactive" reads identically across all three modules.
const displayStatus = (status) => (status === 'TERMINATED' ? 'INACTIVE' : status);

export default function Trainees() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [viewingTrainee, setViewingTrainee] = useState(null);
  const [editingTrainee, setEditingTrainee] = useState(null);
  const [traineeEditForm, setTraineeEditForm] = useState({});
  const [savingTraineeEdit, setSavingTraineeEdit] = useState(false);
  const [tab, setTab] = useState('enrollments');
  const [viewTab, setViewTab] = useState('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [users, setUsers] = useState([]);
  const [enrollableTrainees, setEnrollableTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, trash: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showCreateTraineeModal, setShowCreateTraineeModal] = useState(false);
  const [programForm, setProgramForm] = useState({ name: '', description: '', technology: '', duration: '', trainerId: '', mentorId: '', fee: '', discount: '', finalFee: '', startDate: '', endDate: '' });
  const [enrollForm, setEnrollForm] = useState({ userId: '', programId: '', mentorId: '', totalFee: '', discount: '', finalFee: '' });
  const [topicForm, setTopicForm] = useState({ topic: '', sequence: '', expectedDurationHours: '' });
  const emptyNewTraineeForm = { email: '', password: '', firstName: '', lastName: '', phone: '' };
  const [newTraineeForm, setNewTraineeForm] = useState(emptyNewTraineeForm);
  const [savingNewTrainee, setSavingNewTrainee] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [programEditForm, setProgramEditForm] = useState({});
  const [editingTopic, setEditingTopic] = useState(null);
  const [topicEditForm, setTopicEditForm] = useState({});
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    const scope = VIEW_TABS.find((t) => t.value === viewTab).scope;
    const countCall = (completionStatus) => api.get('/trainees/enrollments', { params: { completionStatus, limit: 1 } });

    // allSettled so one failing call (e.g. a transient 429/500) doesn't
    // blank the whole page — same fix already applied to Interns/Employees.
    Promise.allSettled([
      api.get('/trainees/enrollments', {
        params: {
          accountStatus: scope.accountStatus,
          completionStatus: scope.completionStatus,
          search: debouncedSearch || undefined,
          page,
          limit: PAGE_SIZE,
        },
      }),
      api.get('/trainees/programs'),
      api.get('/users'),
      api.get('/trainees/enrollable-users'),
      countCall(undefined), // grand total, no completionStatus filter — includes Trash, same convention as Employees/Interns' Total card
      countCall('IN_PROGRESS'),
      countCall('COMPLETED,EXTENDED,CONVERTED_TO_EMPLOYEE'),
      countCall('TERMINATED'),
    ])
      .then(([e, p, u, en, totalCount, activeCount, inactiveCount, trashCount]) => {
        if (e.status === 'fulfilled') {
          setEnrollments(e.value.data.data);
          setMeta(e.value.data.meta || null);
          setSelectedIds(new Set());
        }
        if (p.status === 'fulfilled') {
          setPrograms(p.value.data.data);
          if (!selectedProgramId && p.value.data.data.length) setSelectedProgramId(p.value.data.data[0].id);
        }
        if (u.status === 'fulfilled') setUsers(u.value.data.data);
        if (en.status === 'fulfilled') setEnrollableTrainees(en.value.data.data);
        // Total counts every enrollment regardless of status — Active +
        // Inactive (COMPLETED/EXTENDED/CONVERTED_TO_EMPLOYEE) + Trash, same
        // bucket definitions Interns' summary cards use. Each card updates
        // independently from whichever count call succeeded, so one
        // transient failure doesn't zero out the others.
        setSummary((prev) => ({
          total: totalCount.status === 'fulfilled' ? (totalCount.value.data.meta?.total ?? 0) : prev.total,
          active: activeCount.status === 'fulfilled' ? (activeCount.value.data.meta?.total ?? 0) : prev.active,
          inactive: inactiveCount.status === 'fulfilled' ? (inactiveCount.value.data.meta?.total ?? 0) : prev.inactive,
          trash: trashCount.status === 'fulfilled' ? (trashCount.value.data.meta?.total ?? 0) : prev.trash,
        }));

        const failed = [e, p, u, en, totalCount, activeCount, inactiveCount, trashCount].find((r) => r.status === 'rejected');
        if (failed) {
          const status = failed.reason?.response?.status;
          const message = status === 429
            ? 'Too many requests right now — some data may be out of date. Please wait a moment and refresh.'
            : (failed.reason?.response?.data?.message || 'Some trainee data failed to load — showing partial results.');
          toast.error(message);
        }
      })
      .finally(() => setLoading(false));
  };
  // Debounced so typing in the search box doesn't re-fire all 4 parallel
  // calls below (including 3 that don't even depend on the search term) on
  // every keystroke — same fix already applied to Interns.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => { setPage(1); }, [viewTab, debouncedSearch]);
  useEffect(load, [viewTab, debouncedSearch, page]);

  useEffect(() => {
    if (!selectedProgramId) return;
    api.get('/trainees/topics', { params: { programId: selectedProgramId } }).then(({ data }) => setTopics(data.data));
  }, [selectedProgramId]);

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/programs', {
        ...programForm,
        fee: numOrNull(programForm.fee),
        discount: numOrNull(programForm.discount),
        finalFee: numOrNull(programForm.finalFee),
      });
      toast.success('Training program created');
      setShowProgramModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create program');
    } finally {
      setSaving(false);
    }
  };

  // Create Trainee (profile only, no program) is deliberately separate from
  // Enroll Trainee (assigns an existing trainee profile to a program) — see
  // Interns' identical New Intern / Enroll to Batch split. Reuses the
  // existing generic POST /users (role=TRAINEE) rather than a new endpoint;
  // createUser already handles TRAINEE's employmentType default.
  const handleCreateTrainee = async (e) => {
    e.preventDefault();
    if (savingNewTrainee) return;
    setSavingNewTrainee(true);
    try {
      await api.post('/users', { ...newTraineeForm, phone: newTraineeForm.phone || null, role: 'TRAINEE' });
      toast.success('Trainee profile created');
      setShowCreateTraineeModal(false);
      setNewTraineeForm(emptyNewTraineeForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create trainee profile');
    } finally {
      setSavingNewTrainee(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/enrollments', {
        ...enrollForm,
        totalFee: numOrNull(enrollForm.totalFee),
        discount: numOrNull(enrollForm.discount),
        finalFee: numOrNull(enrollForm.finalFee),
      });
      toast.success('Trainee enrolled');
      setShowEnrollModal(false);
      setEnrollForm({ userId: '', programId: '', mentorId: '', totalFee: '', discount: '', finalFee: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enroll trainee');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/topics', {
        ...topicForm,
        programId: selectedProgramId,
        sequence: topicForm.sequence === '' ? 0 : parseInt(topicForm.sequence, 10),
        expectedDurationHours: numOrNull(topicForm.expectedDurationHours),
      });
      toast.success('Topic added');
      setShowTopicModal(false);
      setTopicForm({ topic: '', sequence: '', expectedDurationHours: '' });
      const { data } = await api.get('/trainees/topics', { params: { programId: selectedProgramId } });
      setTopics(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add topic');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminate = async (enrollment) => {
    if (!window.confirm(`Remove ${enrollment.user.firstName} ${enrollment.user.lastName} as a trainee? Their account will be deactivated and the record moved to Trash — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/trainees/enrollments/${enrollment.id}`);
      toast.success('Trainee moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove trainee');
    }
  };

  const handleRestore = async (enrollment) => {
    try {
      await api.post(`/trainees/enrollments/${enrollment.id}/restore`);
      toast.success('Trainee restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore trainee');
    }
  };

  // Irreversible — DELETE /trainees/enrollments/:id/permanent (Super Admin
  // only, requires the trainee already be in Trash) permanently deletes the
  // entire account, not a re-run of Move to Trash. Only ever reachable from
  // the Trash view, so it can never affect an active trainee. Mirrors
  // Employees'/Interns' handlePermanentlyDelete exactly.
  const handlePermanentlyDelete = async (enrollment) => {
    if (!window.confirm(`Permanently delete ${enrollment.user.firstName} ${enrollment.user.lastName}? This will remove their entire account and history. This cannot be undone.`)) return;
    try {
      await api.delete(`/trainees/enrollments/${enrollment.id}/permanent`);
      toast.success('Trainee permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete trainee');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected trainee(s)? Their accounts will be deactivated and moved to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/trainees/enrollments/${id}`)));
      toast.success(`${ids.length} trainee(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected trainees');
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

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportErrors(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Rows with no "Role" column default to TRAINEE here (Employees'
      // Import leaves this unset, defaulting to EMPLOYEE) — same shared
      // POST /users/import endpoint, see user.controller.js.
      formData.append('defaultRole', 'TRAINEE');
      const { data } = await api.post('/users/import', formData);
      toast.success(data.data.message || `${data.data.imported} trainee(s) imported`);
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

  const openTraineeEdit = (r) => {
    setEditingTrainee(r);
    setTraineeEditForm({
      mentorId: r.mentor?.id || '',
      completionStatus: r.completionStatus,
      trainingStartDate: r.trainingStartDate ? r.trainingStartDate.slice(0, 10) : '',
      trainingEndDate: r.trainingEndDate ? r.trainingEndDate.slice(0, 10) : '',
      totalFee: r.totalFee ?? '',
      discount: r.discount ?? '',
      finalFee: r.finalFee ?? '',
      notes: r.notes || '',
    });
  };

  const handleSaveTraineeEdit = async (e) => {
    e.preventDefault();
    setSavingTraineeEdit(true);
    try {
      await api.put(`/trainees/enrollments/${editingTrainee.id}`, {
        ...traineeEditForm,
        mentorId: traineeEditForm.mentorId || null,
        trainingStartDate: traineeEditForm.trainingStartDate || null,
        trainingEndDate: traineeEditForm.trainingEndDate || null,
        totalFee: numOrNull(traineeEditForm.totalFee),
        discount: numOrNull(traineeEditForm.discount),
        finalFee: numOrNull(traineeEditForm.finalFee),
      });
      toast.success('Trainee enrollment updated');
      setEditingTrainee(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update trainee enrollment');
    } finally {
      setSavingTraineeEdit(false);
    }
  };

  const openProgramEdit = (p) => {
    setEditingProgram(p);
    setProgramEditForm({
      name: p.name, description: p.description || '', technology: p.technology || '', duration: p.duration || '',
      trainerId: p.trainer.id, mentorId: p.mentor?.id || '',
      fee: p.fee ?? '', discount: p.discount ?? '', finalFee: p.finalFee ?? '',
      startDate: p.startDate.slice(0, 10), endDate: p.endDate.slice(0, 10), status: p.status,
    });
  };

  const handleSaveProgramEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/trainees/programs/${editingProgram.id}`, {
        ...programEditForm,
        fee: numOrNull(programEditForm.fee), discount: numOrNull(programEditForm.discount), finalFee: numOrNull(programEditForm.finalFee),
      });
      toast.success('Program updated');
      setEditingProgram(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update program');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async (p) => {
    if (!window.confirm(`Delete program "${p.name}"? This cannot be undone. The program must have no enrollments left in it.`)) return;
    try {
      await api.delete(`/trainees/programs/${p.id}`);
      toast.success('Program removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete program');
    }
  };

  const openTopicEdit = (t) => {
    setEditingTopic(t);
    setTopicEditForm({
      topic: t.topic, description: t.description || '', sequence: t.sequence, expectedDurationHours: t.expectedDurationHours ?? '', active: t.active,
    });
  };

  const handleSaveTopicEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/trainees/topics/${editingTopic.id}`, {
        ...topicEditForm,
        sequence: topicEditForm.sequence === '' ? 0 : parseInt(topicEditForm.sequence, 10),
        expectedDurationHours: numOrNull(topicEditForm.expectedDurationHours),
      });
      toast.success('Topic updated');
      setEditingTopic(null);
      const { data } = await api.get('/trainees/topics', { params: { programId: selectedProgramId } });
      setTopics(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update topic');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async (t) => {
    if (!window.confirm(`Delete topic "${t.topic}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/trainees/topics/${t.id}`);
      toast.success('Topic removed');
      const { data } = await api.get('/trainees/topics', { params: { programId: selectedProgramId } });
      setTopics(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete topic');
    }
  };

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible trainees"
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
    ...(isSuperAdmin ? [selectColumn] : []),
    { key: 'name', header: 'Trainee', render: (r) => <Link to={`/trainees/${r.id}`}>{r.user.firstName} {r.user.lastName}</Link> },
    { key: 'program', header: 'Program', render: (r) => r.program.name },
    { key: 'mentor', header: 'Mentor', render: (r) => r.mentor ? `${r.mentor.firstName} ${r.mentor.lastName}` : '—' },
    { key: 'progressPercent', header: 'Progress', render: (r) => `${r.progressPercent}%` },
    { key: 'completionStatus', header: 'Status', render: (r) => <Badge value={r.completionStatus} label={displayStatus(r.completionStatus)} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingTrainee(r) },
            isManager && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openTraineeEdit(r) },
            // Delete is Super-Admin-only, matching the existing backend gate
            // (DELETE /trainees/enrollments/:id, isSuperAdmin) — unlike
            // Interns, this was never opened up to mentor-scoped Admins.
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleTerminate(r) },
          ]}
        />
      ),
    },
  ];

  // Trash gets its own narrower column set — no Edit on an already-removed
  // record, just enough to identify who it is, restore them, or (Super
  // Admin only) permanently delete them (same convention as
  // Employees/Interns' trashColumns).
  const trashColumns = [
    { key: 'name', header: 'Trainee', render: (r) => <Link to={`/trainees/${r.id}`}>{r.user.firstName} {r.user.lastName}</Link> },
    { key: 'program', header: 'Program', render: (r) => r.program.name },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.completionStatus} label={displayStatus(r.completionStatus)} /> },
    { key: 'exitDate', header: 'Removed Date', render: (r) => r.user.exitDate ? new Date(r.user.exitDate).toLocaleDateString() : '—' },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingTrainee(r) },
            isSuperAdmin && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
            // Super-Admin-only, matching the backend route's gate exactly —
            // same Trash2 icon and confirm-then-delete style as
            // Employees/Interns → Trash's Delete Permanently.
            isSuperAdmin && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDelete(r) },
          ]}
        />
      ),
    },
  ];

  const programColumns = [
    { key: 'name', header: 'Program' },
    { key: 'technology', header: 'Technology', render: (r) => r.technology || '—' },
    { key: 'trainer', header: 'Trainer', render: (r) => `${r.trainer.firstName} ${r.trainer.lastName}` },
    { key: 'startDate', header: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', header: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'count', header: 'Trainees', render: (r) => r._count?.enrollments ?? 0 },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openProgramEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete', danger: true, onClick: () => handleDeleteProgram(r) },
          ]}
        />
      ),
    },
  ];

  const topicColumns = [
    { key: 'sequence', header: '#' },
    { key: 'topic', header: 'Topic' },
    { key: 'expectedDurationHours', header: 'Hours', render: (r) => r.expectedDurationHours ?? '—' },
    { key: 'active', header: 'Status', render: (r) => <Badge value={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openTopicEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete', danger: true, onClick: () => handleDeleteTopic(r) },
          ]}
        />
      ),
    },
  ];

  const staffUsers = users.filter((u) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(u.role));

  return (
    <div>
      <PageHeader
        title="Trainee Management"
        subtitle="Training programs, curriculum topics, and trainee lifecycle"
        actions={(
          <>
            {/* Contextual per tab — mirrors the Interns page's pattern.
                Trainees: full trainee-lifecycle action set. Programs: only
                the program-creation action (Import/Export/New Trainee/Enroll
                don't apply to a program list). Curriculum Topics: nothing
                here at all — its own local toolbar below already has the
                program selector + Add Topic, which are the only actions
                that apply there. */}
            {tab === 'enrollments' && (
              <>
                {isSuperAdmin && (
                  <>
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
                    <button className="btn btn-soft-blue" onClick={() => downloadReport('/reports/trainees', 'trainees.csv')}><Download size={16} strokeWidth={2.5} /> Export CSV</button>
                    <button className="btn btn-soft-green" onClick={() => downloadReport('/reports/trainees?format=xlsx', 'trainees.xlsx')}><Download size={16} strokeWidth={2.5} /> Export Excel</button>
                  </>
                )}
                <button className="btn btn-soft-purple" onClick={() => setShowCreateTraineeModal(true)}><UserPlus size={16} strokeWidth={2.5} /> New Trainee</button>
                <button className="btn btn-primary" onClick={() => setShowEnrollModal(true)}><UserCheck size={16} strokeWidth={2.5} /> Enroll Trainee</button>
              </>
            )}
            {tab === 'programs' && (
              <button className="btn btn-soft-purple" onClick={() => setShowProgramModal(true)}><Plus size={16} strokeWidth={2.5} /> New Program</button>
            )}
          </>
        )}
      />

      {tab === 'enrollments' && (
        <div className="stat-grid">
          <StatCard label="Total Trainees" value={summary.total} accent="blue" icon={Users} />
          <StatCard label="Active / In Progress" value={summary.active} accent="green" icon={UserCheck} />
          <StatCard label="Inactive" value={summary.inactive} accent="amber" icon={UserX} />
          <StatCard label="Trash" value={summary.trash} accent="red" icon={Trash2} />
        </div>
      )}

      {/* Single compact toolbar row, shared pattern: main tabs, then the
          Active/All status filter, then Trash pinned to the far right via
          .toolbar-actions. */}
      <div className="toolbar">
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`tab ${tab === 'enrollments' ? 'active' : ''}`} onClick={() => setTab('enrollments')}>Trainees</button>
          <button className={`tab ${tab === 'programs' ? 'active' : ''}`} onClick={() => setTab('programs')}>Programs</button>
          <button className={`tab ${tab === 'topics' ? 'active' : ''}`} onClick={() => setTab('topics')}>Curriculum Topics</button>
        </div>

        {tab === 'enrollments' && (
          <>
            <span className="search-input-wrap">
              <Search size={16} strokeWidth={2.5} />
              <input className="search-input" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search trainees" />
            </span>
            <select value={viewTab === 'trash' ? 'active' : viewTab} onChange={(e) => setViewTab(e.target.value)} aria-label="Filter by status">
              {VIEW_TABS.filter((t) => t.value !== 'trash').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="toolbar-actions">
              <button type="button" className={`tab ${viewTab === 'trash' ? 'active' : ''}`} onClick={() => setViewTab('trash')}>
                🗑️ Trash{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}
              </button>
            </div>
          </>
        )}
      </div>

      {tab === 'enrollments' && isSuperAdmin && viewTab !== 'trash' && selectedIds.size > 0 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <span>{selectedIds.size} selected</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={16} strokeWidth={2.5} /> Delete Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          {tab === 'enrollments' && (
            <>
              {viewTab === 'active' && enrollableTrainees.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p className="detail-section-title">Not Yet Enrolled ({enrollableTrainees.length})</p>
                  <p className="empty-state" style={{ padding: 0, textAlign: 'left', marginBottom: 8 }}>
                    These trainee profiles have been created but not yet assigned to a program — use Enroll Trainee to add them below.
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
                            onClick={() => { setEnrollForm({ userId: r.id, programId: '', mentorId: '', totalFee: '', discount: '', finalFee: '' }); setShowEnrollModal(true); }}
                          >
                            <UserCheck size={14} strokeWidth={2.5} /> Enroll
                          </button>
                        ),
                      },
                    ]}
                    rows={enrollableTrainees}
                  />
                </div>
              )}
              <DataTable
                columns={viewTab === 'trash' ? trashColumns : enrollmentColumns}
                rows={enrollments}
                emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No trainees enrolled yet.'}
              />
              <Pagination meta={meta} onPageChange={setPage} />
            </>
          )}
          {tab === 'programs' && <DataTable columns={programColumns} rows={programs} emptyMessage="No training programs yet." />}
          {tab === 'topics' && (
            <div>
              <div className="toolbar">
                <select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn btn-primary" onClick={() => setShowTopicModal(true)} disabled={!selectedProgramId}><Plus size={16} strokeWidth={2.5} /> Add Topic</button>
              </div>
              <DataTable columns={topicColumns} rows={topics} emptyMessage="No topics defined for this program yet." />
            </div>
          )}
        </>
      )}

      {showProgramModal && (
        <Modal title="New Training Program" onClose={() => setShowProgramModal(false)}>
          <form className="form-grid" onSubmit={handleCreateProgram}>
            <label>Name<input required value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} /></label>
            <label>Technology<input value={programForm.technology} onChange={(e) => setProgramForm({ ...programForm, technology: e.target.value })} /></label>
            <label>Duration<input placeholder="e.g. 3 months" value={programForm.duration} onChange={(e) => setProgramForm({ ...programForm, duration: e.target.value })} /></label>
            <label>Trainer
              <select required value={programForm.trainerId} onChange={(e) => setProgramForm({ ...programForm, trainerId: e.target.value })}>
                <option value="">Select trainer...</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Mentor
              <select value={programForm.mentorId} onChange={(e) => setProgramForm({ ...programForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Fee<input type="number" value={programForm.fee} onChange={(e) => setProgramForm({ ...programForm, fee: e.target.value })} /></label>
            <label>Discount<input type="number" value={programForm.discount} onChange={(e) => setProgramForm({ ...programForm, discount: e.target.value })} /></label>
            <label>Final Fee<input type="number" value={programForm.finalFee} onChange={(e) => setProgramForm({ ...programForm, finalFee: e.target.value })} /></label>
            <label>Start Date<input type="date" required value={programForm.startDate} onChange={(e) => setProgramForm({ ...programForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={programForm.endDate} onChange={(e) => setProgramForm({ ...programForm, endDate: e.target.value })} /></label>
            <label>Description<textarea value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowProgramModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateTraineeModal && (
        <Modal title="New Trainee" onClose={() => setShowCreateTraineeModal(false)}>
          <form className="form-grid" onSubmit={handleCreateTrainee}>
            <label>First name<input required value={newTraineeForm.firstName} onChange={(e) => setNewTraineeForm({ ...newTraineeForm, firstName: e.target.value })} /></label>
            <label>Last name<input required value={newTraineeForm.lastName} onChange={(e) => setNewTraineeForm({ ...newTraineeForm, lastName: e.target.value })} /></label>
            <label>Email<input type="email" required value={newTraineeForm.email} onChange={(e) => setNewTraineeForm({ ...newTraineeForm, email: e.target.value })} /></label>
            <label>Temporary password<input type="password" required value={newTraineeForm.password} onChange={(e) => setNewTraineeForm({ ...newTraineeForm, password: e.target.value })} /></label>
            <label>Phone<input value={newTraineeForm.phone} onChange={(e) => setNewTraineeForm({ ...newTraineeForm, phone: e.target.value })} /></label>
            <p className="empty-state" style={{ padding: 0, textAlign: 'left', marginTop: -4 }}>
              This only creates the trainee's profile. Use "Enroll Trainee" afterward to assign them to a program.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreateTraineeModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingNewTrainee}>{savingNewTrainee ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showEnrollModal && (
        <Modal title="Enroll Trainee" onClose={() => setShowEnrollModal(false)}>
          <form className="form-grid" onSubmit={handleEnroll}>
            <label>Trainee
              <select required value={enrollForm.userId} onChange={(e) => setEnrollForm({ ...enrollForm, userId: e.target.value })}>
                <option value="">Select trainee...</option>
                {enrollableTrainees.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Program
              <select required value={enrollForm.programId} onChange={(e) => setEnrollForm({ ...enrollForm, programId: e.target.value })}>
                <option value="">Select program...</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Mentor
              <select value={enrollForm.mentorId} onChange={(e) => setEnrollForm({ ...enrollForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Total Fee<input type="number" value={enrollForm.totalFee} onChange={(e) => setEnrollForm({ ...enrollForm, totalFee: e.target.value })} /></label>
            <label>Discount<input type="number" value={enrollForm.discount} onChange={(e) => setEnrollForm({ ...enrollForm, discount: e.target.value })} /></label>
            <label>Final Fee<input type="number" value={enrollForm.finalFee} onChange={(e) => setEnrollForm({ ...enrollForm, finalFee: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowEnrollModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Enroll'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showTopicModal && (
        <Modal title="Add Curriculum Topic" onClose={() => setShowTopicModal(false)}>
          <form className="form-grid" onSubmit={handleCreateTopic}>
            <label>Topic<input required value={topicForm.topic} onChange={(e) => setTopicForm({ ...topicForm, topic: e.target.value })} /></label>
            <label>Sequence<input type="number" value={topicForm.sequence} onChange={(e) => setTopicForm({ ...topicForm, sequence: e.target.value })} /></label>
            <label>Expected Hours<input type="number" value={topicForm.expectedDurationHours} onChange={(e) => setTopicForm({ ...topicForm, expectedDurationHours: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowTopicModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewingTrainee && (
        <Modal size="wide" title={`${viewingTrainee.user.firstName} ${viewingTrainee.user.lastName}`} onClose={() => setViewingTrainee(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewingTrainee.completionStatus} label={displayStatus(viewingTrainee.completionStatus)} />
              <Badge value={viewingTrainee.user.status} label={displayStatus(viewingTrainee.user.status)} />
            </div>
            <div className="detail-grid">
              <DetailField icon={Mail} label="Email" value={viewingTrainee.user.email} />
              <DetailField label="Program" value={viewingTrainee.program?.name} />
              <DetailField label="Mentor" value={viewingTrainee.mentor ? `${viewingTrainee.mentor.firstName} ${viewingTrainee.mentor.lastName}` : null} />
              <DetailField label="Progress" value={`${viewingTrainee.progressPercent ?? 0}%`} />
              <DetailField label="Total Fee" value={viewingTrainee.totalFee != null ? `₹${viewingTrainee.totalFee.toLocaleString()}` : null} />
              <DetailField label="Final Fee" value={viewingTrainee.finalFee != null ? `₹${viewingTrainee.finalFee.toLocaleString()}` : null} />
              <DetailField full label="Notes" value={viewingTrainee.notes} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewingTrainee(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editingTrainee && (
        <Modal title={`Edit Enrollment — ${editingTrainee.user.firstName} ${editingTrainee.user.lastName}`} onClose={() => setEditingTrainee(null)}>
          <form className="form-grid" onSubmit={handleSaveTraineeEdit}>
            <label>Mentor
              <select value={traineeEditForm.mentorId} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Completion Status
              <select value={traineeEditForm.completionStatus} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, completionStatus: e.target.value })}>
                {EDITABLE_COMPLETION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Training Start Date<input type="date" value={traineeEditForm.trainingStartDate} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, trainingStartDate: e.target.value })} /></label>
            <label>Training End Date<input type="date" value={traineeEditForm.trainingEndDate} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, trainingEndDate: e.target.value })} /></label>
            <label>Total Fee<input type="number" value={traineeEditForm.totalFee} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, totalFee: e.target.value })} /></label>
            <label>Discount<input type="number" value={traineeEditForm.discount} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, discount: e.target.value })} /></label>
            <label>Final Fee<input type="number" value={traineeEditForm.finalFee} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, finalFee: e.target.value })} /></label>
            <label>Notes<textarea value={traineeEditForm.notes} onChange={(e) => setTraineeEditForm({ ...traineeEditForm, notes: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTrainee(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingTraineeEdit}>{savingTraineeEdit ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editingProgram && (
        <Modal title={`Edit Program — ${editingProgram.name}`} onClose={() => setEditingProgram(null)}>
          <form className="form-grid" onSubmit={handleSaveProgramEdit}>
            <label>Name<input required value={programEditForm.name} onChange={(e) => setProgramEditForm({ ...programEditForm, name: e.target.value })} /></label>
            <label>Technology<input value={programEditForm.technology} onChange={(e) => setProgramEditForm({ ...programEditForm, technology: e.target.value })} /></label>
            <label>Duration<input value={programEditForm.duration} onChange={(e) => setProgramEditForm({ ...programEditForm, duration: e.target.value })} /></label>
            <label>Trainer
              <select required value={programEditForm.trainerId} onChange={(e) => setProgramEditForm({ ...programEditForm, trainerId: e.target.value })}>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Mentor
              <select value={programEditForm.mentorId} onChange={(e) => setProgramEditForm({ ...programEditForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Fee<input type="number" value={programEditForm.fee} onChange={(e) => setProgramEditForm({ ...programEditForm, fee: e.target.value })} /></label>
            <label>Discount<input type="number" value={programEditForm.discount} onChange={(e) => setProgramEditForm({ ...programEditForm, discount: e.target.value })} /></label>
            <label>Final Fee<input type="number" value={programEditForm.finalFee} onChange={(e) => setProgramEditForm({ ...programEditForm, finalFee: e.target.value })} /></label>
            <label>Start Date<input type="date" required value={programEditForm.startDate} onChange={(e) => setProgramEditForm({ ...programEditForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={programEditForm.endDate} onChange={(e) => setProgramEditForm({ ...programEditForm, endDate: e.target.value })} /></label>
            <label>Status
              <select value={programEditForm.status} onChange={(e) => setProgramEditForm({ ...programEditForm, status: e.target.value })}>
                {['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Description<textarea value={programEditForm.description} onChange={(e) => setProgramEditForm({ ...programEditForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingProgram(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editingTopic && (
        <Modal title={`Edit Topic — ${editingTopic.topic}`} onClose={() => setEditingTopic(null)}>
          <form className="form-grid" onSubmit={handleSaveTopicEdit}>
            <label>Topic<input required value={topicEditForm.topic} onChange={(e) => setTopicEditForm({ ...topicEditForm, topic: e.target.value })} /></label>
            <label>Sequence<input type="number" value={topicEditForm.sequence} onChange={(e) => setTopicEditForm({ ...topicEditForm, sequence: e.target.value })} /></label>
            <label>Expected Hours<input type="number" value={topicEditForm.expectedDurationHours} onChange={(e) => setTopicEditForm({ ...topicEditForm, expectedDurationHours: e.target.value })} /></label>
            <label>Description<textarea value={topicEditForm.description} onChange={(e) => setTopicEditForm({ ...topicEditForm, description: e.target.value })} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={topicEditForm.active} onChange={(e) => setTopicEditForm({ ...topicEditForm, active: e.target.checked })} />
              Active
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTopic(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
