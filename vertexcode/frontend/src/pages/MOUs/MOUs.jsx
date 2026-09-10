import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Eye, Pencil, FileSignature, CheckCircle2, AlertTriangle, XCircle, Search, RotateCcw } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

const STATUSES = ['DISCUSSION', 'DRAFT', 'SENT', 'UNDER_REVIEW', 'APPROVED', 'SIGNED', 'ACTIVE', 'EXPIRED', 'RENEWED', 'CANCELLED'];
// Active/All/Trash — same convention as Projects/Workshops (deletedAt-based;
// MOU has no separate Active/Inactive axis beyond this real 10-value status
// workflow, so the list filter below narrows by status, independent of
// Trash).
const VIEW_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'trash', label: '🗑️ Trash' },
];
const STATUS_FILTER_OPTIONS = [{ value: '', label: 'All Statuses' }, ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))];

const emptyForm = {
  collegeId: '', contactPerson: '', mouType: '', purpose: '', startDate: '', endDate: '',
  assignedEmployeeId: '', status: 'DISCUSSION',
};

export default function MOUs() {
  const { user } = useAuth();
  const [viewing, setViewing] = useState(null);
  const [mous, setMous] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef(null);
  const [viewTab, setViewTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [summary, setSummary] = useState({ total: 0, trash: 0 });
  // Unfiltered "active" snapshot, fetched independently of the table's
  // current status filter/search/Trash tab, purely to compute the
  // Active/Expiring Soon/Expired stat cards — so switching a list filter
  // never shifts those numbers (same fix already applied to Workshops).
  const [statsMous, setStatsMous] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/mous', {
        params: {
          scope: viewTab,
          status: viewTab === 'trash' ? undefined : (statusFilter || undefined),
          search: debouncedSearch || undefined,
        },
      }),
      api.get('/mous/summary'),
      api.get('/mous', { params: { scope: 'active' } }),
      api.get('/colleges'),
      api.get('/users'),
    ])
      .then(([m, s, statsM, c, u]) => {
        if (m.status === 'fulfilled') { setMous(m.value.data.data); setSelectedIds(new Set()); }
        if (s.status === 'fulfilled') setSummary(s.value.data.data);
        if (statsM.status === 'fulfilled') setStatsMous(statsM.value.data.data);
        if (c.status === 'fulfilled') setColleges(c.value.data.data);
        if (u.status === 'fulfilled') setStaffUsers(u.value.data.data.filter((x) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
        const failed = [m, s, statsM, c, u].find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some MOU data failed to load');
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
      await api.post('/mous', { ...form, assignedEmployeeId: form.assignedEmployeeId || null });
      toast.success('MOU created');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create MOU');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m) => {
    setEditing(m);
    setEditForm({
      status: m.status,
      endDate: m.endDate ? m.endDate.slice(0, 10) : '',
      signedDate: m.signedDate ? m.signedDate.slice(0, 10) : '',
      renewalDate: m.renewalDate ? m.renewalDate.slice(0, 10) : '',
      remarks: m.remarks || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/mous/${editing.id}`, editForm);
      toast.success('MOU updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update MOU');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Remove this MOU${m.mouType ? ` (${m.mouType})` : ''}? It will move to Trash — this can be undone with Restore.`)) return;
    try {
      await api.delete(`/mous/${m.id}`);
      toast.success('MOU moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove MOU');
    }
  };

  const handleRestore = async (m) => {
    try {
      await api.post(`/mous/${m.id}/restore`);
      toast.success('MOU restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore MOU');
    }
  };

  // Irreversible — DELETE /mous/:id/permanent (Super Admin only, requires
  // the MOU already be in Trash) — same pattern used everywhere else in
  // this app.
  const handlePermanentlyDelete = async (m) => {
    if (!window.confirm(`Permanently delete this MOU${m.mouType ? ` (${m.mouType})` : ''}? This cannot be undone.`)) return;
    try {
      await api.delete(`/mous/${m.id}/permanent`);
      toast.success('MOU permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete MOU');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected MOU(s)? They will move to Trash — this can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/mous/${id}`)));
      toast.success(`${ids.length} MOU(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected MOUs');
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
  const visibleIds = mous.map((m) => m.id);
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

  const handleDocumentSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingDoc(true);
    try {
      const { data } = await api.post(`/mous/${editing.id}/document`, formData);
      toast.success('Document attached');
      setEditing((prev) => ({ ...prev, documentPath: data.data.documentPath, documentName: data.data.documentName }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to attach document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDocument = async () => {
    try {
      await downloadReport(`/mous/${editing.id}/document`, editing.documentName || 'mou-document');
    } catch (err) {
      toast.error('Failed to download document');
    }
  };

  // Total/Trash come from the summary endpoint (scope-independent); the
  // other two are computed from the separate unfiltered `statsMous`
  // snapshot — mirrors analytics.controller.js's exact definitions (active =
  // status ACTIVE; expiring soon = the same `expiringSoon`/`expired` flags
  // college.controller.js already attaches per row).
  const mouStats = {
    total: summary.total,
    active: statsMous.filter((m) => m.status === 'ACTIVE').length,
    expiringSoon: statsMous.filter((m) => m.expiringSoon).length,
    expired: statsMous.filter((m) => m.expired).length,
    trash: summary.trash,
  };

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible MOUs"
        checked={allVisibleSelected}
        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
        onChange={toggleSelectAllVisible}
      />
    ),
    render: (r) => (
      <input
        type="checkbox"
        aria-label={`Select ${r.mouType || 'MOU'}`}
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelectOne(r.id)}
      />
    ),
  };

  const columns = [
    ...(user.role === 'SUPER_ADMIN' ? [selectColumn] : []),
    { key: 'mouType', header: 'Type', render: (r) => r.mouType || '—' },
    { key: 'college', header: 'College', render: (r) => r.college.name },
    { key: 'assignee', header: 'Assigned To', render: (r) => r.assignedEmployee ? `${r.assignedEmployee.firstName} ${r.assignedEmployee.lastName}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'expiry', header: 'Expiry', render: (r) => {
        if (!r.endDate) return '—';
        if (r.expired) return <span className="badge badge-red">EXPIRED</span>;
        if (r.expiringSoon) return <span className="badge badge-amber">MOU EXPIRING SOON ({r.daysToExpiry}d)</span>;
        return new Date(r.endDate).toLocaleDateString();
      },
    },
    {
      key: 'actions', header: 'Actions', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            user.role === 'SUPER_ADMIN' && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  // Trash gets its own, narrower column set — no Edit on an already-removed
  // record, just enough to identify it, restore it, or (Super Admin only)
  // permanently delete it — same convention as Departments/Projects/
  // Colleges/Workshops' trashColumns.
  const trashColumns = [
    { key: 'mouType', header: 'Type', render: (r) => r.mouType || '—' },
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
        title="MOU Management"
        subtitle="Memorandums of understanding with partner colleges"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New MOU</button>}
      />

      <div className="stat-grid">
        <StatCard label="Total MOUs" value={mouStats.total} accent="blue" icon={FileSignature} />
        <StatCard label="Active" value={mouStats.active} accent="green" icon={CheckCircle2} />
        <StatCard label="Expiring Soon" value={mouStats.expiringSoon} accent={mouStats.expiringSoon > 0 ? 'amber' : 'green'} icon={AlertTriangle} />
        <StatCard label="Expired" value={mouStats.expired} accent={mouStats.expired > 0 ? 'red' : 'green'} icon={XCircle} />
        <StatCard label="Trash" value={mouStats.trash} accent="red" icon={Trash2} />
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
          <input className="search-input" placeholder="Search by type, contact or purpose..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search MOUs" />
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
          rows={mous}
          emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No MOUs recorded yet.'}
        />
      )}

      {showModal && (
        <Modal title="New MOU" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>College
              <select required value={form.collegeId} onChange={(e) => setForm({ ...form, collegeId: e.target.value })}>
                <option value="">Select college...</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>MOU Type<input value={form.mouType} onChange={(e) => setForm({ ...form, mouType: e.target.value })} /></label>
            <label>Purpose<textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Start Date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Assigned Employee
              <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
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
        <Modal size="wide" title={viewing.mouType || 'MOU'} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.status} />
              {viewing.expired && <Badge value="EXPIRED" />}
              {viewing.expiringSoon && !viewing.expired && <Badge value="EXPIRING_SOON" label={`Expiring in ${viewing.daysToExpiry}d`} />}
            </div>
            <div className="detail-grid">
              <DetailField label="College" value={viewing.college?.name} />
              <DetailField label="Contact Person" value={viewing.contactPerson} />
              <DetailField label="Assigned To" value={viewing.assignedEmployee ? `${viewing.assignedEmployee.firstName} ${viewing.assignedEmployee.lastName}` : null} />
              <DetailField label="Start Date" value={viewing.startDate ? new Date(viewing.startDate).toLocaleDateString() : null} />
              <DetailField label="End Date" value={viewing.endDate ? new Date(viewing.endDate).toLocaleDateString() : null} />
              <DetailField label="Signed Date" value={viewing.signedDate ? new Date(viewing.signedDate).toLocaleDateString() : null} />
              <DetailField label="Renewal Date" value={viewing.renewalDate ? new Date(viewing.renewalDate).toLocaleDateString() : null} />
              <DetailField label="Document" value={viewing.documentName || 'Not attached'} />
              <DetailField full label="Purpose" value={viewing.purpose} />
              <DetailField full label="Remarks" value={viewing.remarks} />
            </div>
            {viewing.documentPath && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => downloadReport(`/mous/${viewing.id}/document`, viewing.documentName || 'mou-document').catch(() => toast.error('Failed to download document'))}
              >
                Download Document
              </button>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Update — ${editing.mouType || 'MOU'}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>End Date<input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} /></label>
            <label>Signed Date<input type="date" value={editForm.signedDate} onChange={(e) => setEditForm({ ...editForm, signedDate: e.target.value })} /></label>
            <label>Renewal Date<input type="date" value={editForm.renewalDate} onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })} /></label>
            <label>Remarks<textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <h4>Signed Document</h4>
            <p>{editing.documentName || 'No document attached yet.'}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {editing.documentPath && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadDocument}>Download</button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" disabled={uploadingDoc} onClick={() => docInputRef.current?.click()}>
                {uploadingDoc ? 'Uploading...' : editing.documentPath ? 'Replace File' : 'Attach File'}
              </button>
              <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleDocumentSelected} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
