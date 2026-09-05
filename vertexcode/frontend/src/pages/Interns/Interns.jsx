import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Eye, Mail } from 'lucide-react';
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
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

const COMPLETION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'EXTENDED', 'CONVERTED_TO_EMPLOYEE'];
const BATCH_STATUSES = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'Job Oriented Training (JOT)' };
const PAGE_SIZE = 25;

export default function Interns() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [viewingEnrollment, setViewingEnrollment] = useState(null);

  const [tab, setTab] = useState('enrollments');
  const [enrollments, setEnrollments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [enrollableInterns, setEnrollableInterns] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [mentorFilter, setMentorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
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
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchEditForm, setBatchEditForm] = useState({});

  const load = () => {
    setLoading(true);
    // Managers get the full user directory (for mentor assignment); everyone
    // who can enroll interns gets the scoped "not yet enrolled intern" list
    // (existing intern profiles, role=INTERN, no batch yet) regardless of role.
    const usersCall = isManager ? api.get('/users') : Promise.resolve({ data: { data: [] } });
    const enrollableCall = api.get('/interns/enrollable-users');
    const enrollmentsCall = api.get('/interns/enrollments', {
      params: {
        search: search || undefined,
        batchId: batchFilter || undefined,
        mentorId: mentorFilter || undefined,
        completionStatus: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      },
    });
    Promise.all([enrollmentsCall, api.get('/interns/batches'), usersCall, enrollableCall, api.get('/masters/designations')])
      .then(([e, b, u, en, des]) => {
        setEnrollments(e.data.data);
        setMeta(e.data.meta || null);
        setBatches(b.data.data);
        setUsers(u.data.data);
        setDesignations(des.data.data.filter((d) => d.active));
        setEnrollableInterns(en.data.data);
      })
      .finally(() => setLoading(false));
  };
  // Filter/search changes return to page 1; a bare page change (Pagination's
  // onPageChange) leaves the active filters untouched.
  useEffect(() => { setPage(1); }, [search, batchFilter, mentorFilter, statusFilter]);
  useEffect(load, [search, batchFilter, mentorFilter, statusFilter, page]);

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
    if (!window.confirm(`Remove ${enrollment.user.firstName} ${enrollment.user.lastName} as an intern? This deactivates their account (soft delete) — the record is kept for history.`)) return;
    try {
      await api.delete(`/interns/enrollments/${enrollment.id}`);
      toast.success('Intern removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove intern');
    }
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

  const enrollmentColumns = [
    { key: 'name', header: 'Intern', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (r) => r.batch.name },
    { key: 'mentor', header: 'Mentor', render: (r) => r.mentor ? `${r.mentor.firstName} ${r.mentor.lastName}` : '—' },
    { key: 'progressPercent', header: 'Progress', render: (r) => `${r.progressPercent}%` },
    { key: 'performanceRating', header: 'Rating', render: (r) => r.performanceRating ?? '—' },
    { key: 'completionStatus', header: 'Status', render: (r) => <Badge value={r.completionStatus} /> },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewingEnrollment(r) },
            isManager && { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEnrollEdit(r) },
            // Soft delete only (completionStatus -> TERMINATED + account
            // deactivated — see handleDelete/backend deleteEnrollment).
            // Gated the same as Edit (isManager) since the backend checks
            // the same intern:manage permission for both DELETE and PUT
            // /interns/enrollments/:id — Super Admin and Admin both
            // qualify, Employees (even ones who can add interns) do not.
            isManager && { key: 'trash', icon: Trash2, label: 'Deactivate (soft delete)', danger: true, onClick: () => handleDelete(r) },
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
            {isSuperAdmin && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/interns', 'interns.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/interns?format=xlsx', 'interns.xlsx')}>Export Excel</button>
              </>
            )}
            {isManager && <button className="btn btn-secondary" onClick={() => setShowBatchModal(true)}><Plus size={14} /> New Batch</button>}
            <button className="btn btn-secondary" onClick={() => setShowEnrollModal(true)}><Plus size={14} /> Enroll to Batch</button>
            <button className="btn btn-primary" onClick={() => setShowNewInternModal(true)}><Plus size={14} /> New Intern</button>
          </>
        )}
      />

      <div className="tabs">
        <button className={`tab ${tab === 'enrollments' ? 'active' : ''}`} onClick={() => setTab('enrollments')}>Intern List</button>
        {isManager && <button className={`tab ${tab === 'batches' ? 'active' : ''}`} onClick={() => setTab('batches')}>Enroll Batch</button>}
      </div>

      {tab === 'enrollments' && (
        <div className="toolbar">
          <input className="search-input" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {isManager && (
            <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)}>
              <option value="">All mentors</option>
              {users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {COMPLETION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        tab === 'enrollments' ? (
          <>
            {enrollableInterns.length > 0 && (
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
            <DataTable columns={enrollmentColumns} rows={enrollments} />
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
              <Badge value={viewingEnrollment.completionStatus} />
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
        <Modal title={`Edit Enrollment — ${editingEnrollment.user.firstName} ${editingEnrollment.user.lastName}`} onClose={() => setEditingEnrollment(null)}>
          <form className="form-grid" onSubmit={handleSaveEnrollEdit}>
            <label>Mentor
              <select value={enrollEditForm.mentorId} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN').map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Completion Status
              <select value={enrollEditForm.completionStatus} onChange={(e) => setEnrollEditForm({ ...enrollEditForm, completionStatus: e.target.value })}>
                {COMPLETION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
              <button type="button" className="btn btn-ghost" onClick={() => setEditingEnrollment(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
