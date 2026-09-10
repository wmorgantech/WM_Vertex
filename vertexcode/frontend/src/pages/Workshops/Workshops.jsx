import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, Pencil, Presentation, CalendarClock, AlertTriangle, CheckCircle2, Search, RotateCcw } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import CustomFieldsSection from '../../components/common/CustomFieldsSection';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';

const STATUSES = ['LEAD', 'CONTACTED', 'DISCUSSION', 'PROPOSED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FOLLOW_UP_REQUIRED'];
// Active/All/Trash — same convention as Projects (deletedAt-based; Workshop
// has no separate Active/Inactive axis, just this real 9-value status
// workflow, so the list filter below narrows by status, independent of
// Trash — never a third "status" injected into this tab row).
const VIEW_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'trash', label: '🗑️ Trash' },
];
const STATUS_FILTER_OPTIONS = [{ value: '', label: 'All Statuses' }, ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))];

const emptyForm = {
  collegeId: '', collegeDepartmentId: '', contactPerson: '', contactNumber: '', topic: '', technology: '',
  proposedDate: '', duration: '', expectedParticipants: '', assignedEmployeeId: '', trainerId: '',
};

export default function Workshops() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [viewing, setViewing] = useState(null);
  const [workshops, setWorkshops] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [viewTab, setViewTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [summary, setSummary] = useState({ total: 0, trash: 0 });
  // Unfiltered "active" snapshot, fetched independently of the table's
  // current status filter/search/Trash tab, purely to compute the
  // Upcoming/Follow-ups Overdue/Completed stat cards — so switching a list
  // filter never shifts those numbers (same fix already applied to the
  // Employees/Interns/Trainees summary cards this session).
  const [statsWorkshops, setStatsWorkshops] = useState([]);

  const load = () => {
    setLoading(true);
    const calls = [
      api.get('/workshops', {
        params: {
          scope: viewTab,
          status: viewTab === 'trash' ? undefined : (statusFilter || undefined),
          search: debouncedSearch || undefined,
        },
      }),
      api.get('/workshops/summary'),
      api.get('/workshops', { params: { scope: 'active' } }),
      api.get('/colleges'),
    ];
    if (isManager) calls.push(api.get('/users'));
    Promise.allSettled(calls)
      .then(([w, s, statsW, c, u]) => {
        if (w.status === 'fulfilled') { setWorkshops(w.value.data.data); setSelectedIds(new Set()); }
        if (s.status === 'fulfilled') setSummary(s.value.data.data);
        if (statsW.status === 'fulfilled') setStatsWorkshops(statsW.value.data.data);
        if (c.status === 'fulfilled') setColleges(c.value.data.data);
        if (u && u.status === 'fulfilled') setStaffUsers(u.value.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
        const failed = [w, s, statsW, c, u].filter(Boolean).find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some workshop data failed to load');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(load, [viewTab, statusFilter, debouncedSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/workshops', {
        ...form,
        collegeDepartmentId: form.collegeDepartmentId || null,
        assignedEmployeeId: form.assignedEmployeeId || null,
        trainerId: form.trainerId || null,
        expectedParticipants: form.expectedParticipants === '' ? null : Number(form.expectedParticipants),
      });
      toast.success('Workshop created');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create workshop');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (w) => {
    setEditing(w);
    setEditForm({
      status: w.status, followUpDate: w.followUpDate ? w.followUpDate.slice(0, 10) : '',
      actualParticipants: w.actualParticipants ?? '', discussionNotes: w.discussionNotes || '',
      nextAction: w.nextAction || '', remarks: w.remarks || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/workshops/${editing.id}`, {
        ...editForm,
        actualParticipants: editForm.actualParticipants === '' ? null : Number(editForm.actualParticipants),
      });
      toast.success('Workshop updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update workshop');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (w) => {
    if (!window.confirm(`Remove workshop "${w.topic}"? It will move to Trash — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/workshops/${w.id}`);
      toast.success('Workshop moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove workshop');
    }
  };

  const handleRestore = async (w) => {
    try {
      await api.post(`/workshops/${w.id}/restore`);
      toast.success('Workshop restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore workshop');
    }
  };

  // Irreversible — DELETE /workshops/:id/permanent (Super Admin only,
  // requires the workshop already be in Trash) — same pattern used
  // everywhere else in this app.
  const handlePermanentlyDelete = async (w) => {
    if (!window.confirm(`Permanently delete workshop "${w.topic}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/workshops/${w.id}/permanent`);
      toast.success('Workshop permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete workshop');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected workshop(s)? They will move to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/workshops/${id}`)));
      toast.success(`${ids.length} workshop(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected workshops');
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
  const visibleIds = workshops.map((w) => w.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedCollege = colleges.find((c) => c.id === form.collegeId);

  // Total/Trash come from the summary endpoint (scope-independent); the
  // other three are computed from the separate unfiltered `statsWorkshops`
  // snapshot — mirrors analytics.controller.js's exact definitions
  // (upcoming = SCHEDULED/CONFIRMED; follow-up overdue = the same
  // `followUpOverdue` flag college.controller.js already attaches per row).
  const workshopStats = {
    total: summary.total,
    upcoming: statsWorkshops.filter((w) => ['SCHEDULED', 'CONFIRMED'].includes(w.status)).length,
    followUpsOverdue: statsWorkshops.filter((w) => w.followUpOverdue).length,
    completed: statsWorkshops.filter((w) => w.status === 'COMPLETED').length,
    trash: summary.trash,
  };

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible workshops"
        checked={allVisibleSelected}
        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
        onChange={toggleSelectAllVisible}
      />
    ),
    render: (r) => (
      <input
        type="checkbox"
        aria-label={`Select ${r.topic}`}
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelectOne(r.id)}
      />
    ),
  };

  const columns = [
    ...(user.role === 'SUPER_ADMIN' ? [selectColumn] : []),
    { key: 'topic', header: 'Topic' },
    { key: 'college', header: 'College', render: (r) => r.college.name },
    { key: 'department', header: 'Department', render: (r) => r.collegeDepartment?.name || '—' },
    { key: 'assignee', header: 'Assigned To', render: (r) => r.assignedEmployee ? `${r.assignedEmployee.firstName} ${r.assignedEmployee.lastName}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'followUp', header: 'Follow-up', render: (r) => r.followUpOverdue
        ? <span className="badge badge-red">FOLLOW-UP OVERDUE</span>
        : (r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : '—'),
    },
    {
      key: 'actions', header: 'Actions', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            (isManager || r.assignedEmployee?.id === user.id) && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            user.role === 'SUPER_ADMIN' && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  // Trash gets its own, narrower column set — no Edit on an already-removed
  // record, just enough to identify it, restore it, or (Super Admin only)
  // permanently delete it — same convention as Departments/Projects/
  // Colleges' trashColumns.
  const trashColumns = [
    { key: 'topic', header: 'Topic' },
    { key: 'college', header: 'College', render: (r) => r.college.name },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'deletedAt', header: 'Removed Date', render: (r) => r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : '—' },
    {
      key: 'actions', header: 'Actions', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            user.role === 'SUPER_ADMIN' && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
            user.role === 'SUPER_ADMIN' && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDelete(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Workshop Management"
        subtitle="College workshop pipeline — from lead to completion"
        actions={isManager && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New Workshop</button>}
      />

      <div className="stat-grid">
        <StatCard label="Total Workshops" value={workshopStats.total} accent="blue" icon={Presentation} />
        <StatCard label="Upcoming" value={workshopStats.upcoming} accent="purple" icon={CalendarClock} />
        <StatCard label="Follow-ups Overdue" value={workshopStats.followUpsOverdue} accent={workshopStats.followUpsOverdue > 0 ? 'red' : 'green'} icon={AlertTriangle} />
        <StatCard label="Completed" value={workshopStats.completed} accent="green" icon={CheckCircle2} />
        <StatCard label="Trash" value={workshopStats.trash} accent="red" icon={Trash2} />
      </div>

      <div className="tabs">
        {VIEW_TABS.map((t) => (
          <button key={t.value} className={`tab ${viewTab === t.value ? 'active' : ''}`} onClick={() => setViewTab(t.value)}>
            {t.value === 'trash' ? (<>{t.label}{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}</>) : t.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <span className="search-input-wrap">
          <Search size={16} strokeWidth={2.5} />
          <input className="search-input" placeholder="Search by topic, contact or technology..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search workshops" />
        </span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={viewTab === 'trash'}
          title={viewTab === 'trash' ? 'Status filter does not apply to Trash' : undefined}
          aria-label="Filter by status"
        >
          {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {user.role === 'SUPER_ADMIN' && viewTab !== 'trash' && selectedIds.size > 0 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <span>{selectedIds.size} selected</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={16} strokeWidth={2.5} /> Delete Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        <DataTable
          columns={viewTab === 'trash' ? trashColumns : columns}
          rows={workshops}
          emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No workshops recorded yet.'}
        />
      )}

      {showModal && (
        <Modal title="New Workshop" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>College
              <select required value={form.collegeId} onChange={(e) => setForm({ ...form, collegeId: e.target.value, collegeDepartmentId: '' })}>
                <option value="">Select college...</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {selectedCollege?.departments.length > 0 && (
              <label>Department
                <select value={form.collegeDepartmentId} onChange={(e) => setForm({ ...form, collegeDepartmentId: e.target.value })}>
                  <option value="">— None —</option>
                  {selectedCollege.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            )}
            <label>Topic<input required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></label>
            <label>Technology<input value={form.technology} onChange={(e) => setForm({ ...form, technology: e.target.value })} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Contact Number<input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></label>
            <label>Proposed Date<input type="date" value={form.proposedDate} onChange={(e) => setForm({ ...form, proposedDate: e.target.value })} /></label>
            <label>Duration<input placeholder="e.g. 1 day" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></label>
            <label>Expected Participants<input type="number" value={form.expectedParticipants} onChange={(e) => setForm({ ...form, expectedParticipants: e.target.value })} /></label>
            <label>Assigned Employee
              <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Trainer
              <select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal size="wide" title={viewing.topic} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.status} />
              {viewing.followUpOverdue && <Badge value="OVERDUE" label="Follow-up Overdue" />}
            </div>
            <div className="detail-grid">
              <DetailField label="College" value={viewing.college?.name} />
              <DetailField label="Department" value={viewing.collegeDepartment?.name} />
              <DetailField label="Technology" value={viewing.technology} />
              <DetailField label="Contact Person" value={viewing.contactPerson} />
              <DetailField label="Contact Number" value={viewing.contactNumber} />
              <DetailField label="Assigned To" value={viewing.assignedEmployee ? `${viewing.assignedEmployee.firstName} ${viewing.assignedEmployee.lastName}` : null} />
              <DetailField label="Trainer" value={viewing.trainer ? `${viewing.trainer.firstName} ${viewing.trainer.lastName}` : null} />
              <DetailField label="Proposed Date" value={viewing.proposedDate ? new Date(viewing.proposedDate).toLocaleDateString() : null} />
              <DetailField label="Duration" value={viewing.duration} />
              <DetailField label="Expected Participants" value={viewing.expectedParticipants} />
              <DetailField label="Actual Participants" value={viewing.actualParticipants} />
              <DetailField label="Follow-up Date" value={viewing.followUpDate ? new Date(viewing.followUpDate).toLocaleDateString() : null} />
              <DetailField label="Next Action" value={viewing.nextAction} />
              <DetailField full label="Discussion Notes" value={viewing.discussionNotes} />
              <DetailField full label="Remarks" value={viewing.remarks} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Update — ${editing.topic}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Actual Participants<input type="number" value={editForm.actualParticipants} onChange={(e) => setEditForm({ ...editForm, actualParticipants: e.target.value })} /></label>
            <label>Follow-up Date<input type="date" value={editForm.followUpDate} onChange={(e) => setEditForm({ ...editForm, followUpDate: e.target.value })} /></label>
            <label>Next Action<input value={editForm.nextAction} onChange={(e) => setEditForm({ ...editForm, nextAction: e.target.value })} /></label>
            <label>Discussion Notes<textarea value={editForm.discussionNotes} onChange={(e) => setEditForm({ ...editForm, discussionNotes: e.target.value })} /></label>
            <label>Remarks<textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
          <CustomFieldsSection entityType="WORKSHOP" entityId={editing.id} />
        </Modal>
      )}
    </div>
  );
}
