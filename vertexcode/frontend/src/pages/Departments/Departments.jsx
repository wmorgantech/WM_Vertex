import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, RotateCcw, Building2, CheckCircle2, Search } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';

// Active/All only — Department has no active/status field to reuse (see
// department.controller.js's scopeWhere: only `deletedAt` exists), so there
// is no real "Inactive" state to filter on; adding one would be a fake
// filter with nothing behind it. Trash is a separate axis (soft-delete),
// pinned to the toolbar's far right like every other module, not a third
// value of this same dropdown.
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
];

export default function Departments() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [summary, setSummary] = useState({ total: 0, active: 0, trash: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [viewing, setViewing] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      api.get('/departments', { params: { scope: viewTab, search: debouncedSearch || undefined } }),
      api.get('/departments/summary'),
    ])
      .then(([d, s]) => {
        if (d.status === 'fulfilled') {
          setDepartments(d.value.data.data);
          setSelectedIds(new Set());
        }
        if (s.status === 'fulfilled') setSummary(s.value.data.data);
        const failed = [d, s].find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some department data failed to load');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(load, [viewTab, debouncedSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/departments', form);
      toast.success('Department created');
      setShowModal(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  const openView = (d) => {
    setViewing({ ...d, users: null });
    setViewLoading(true);
    api.get(`/departments/${d.id}`)
      .then(({ data }) => setViewing(data.data))
      .catch(() => toast.error('Failed to load department details'))
      .finally(() => setViewLoading(false));
  };

  const openEdit = (d) => {
    setEditing(d);
    setEditForm({ name: d.name, description: d.description || '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/departments/${editing.id}`, editForm);
      toast.success('Department updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Remove department "${d.name}"? It will move to Trash — this can be undone with Restore, and is blocked if members still belong to it.`)) return;
    try {
      await api.delete(`/departments/${d.id}`);
      toast.success('Department moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove department');
    }
  };

  const handleRestore = async (d) => {
    try {
      await api.post(`/departments/${d.id}/restore`);
      toast.success('Department restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore department');
    }
  };

  // Irreversible — DELETE /departments/:id/permanent (Super Admin only,
  // requires the department already be in Trash) — same pattern as
  // Employees/Interns/Trainees' permanent delete.
  const handlePermanentlyDelete = async (d) => {
    if (!window.confirm(`Permanently delete department "${d.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/departments/${d.id}/permanent`);
      toast.success('Department permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete department');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} selected department(s)? Departments with members still assigned will be skipped — reassign those members first.`)) return;
    let failed = 0;
    for (const id of ids) {
      try {
        await api.delete(`/departments/${id}`);
      } catch {
        failed += 1;
      }
    }
    if (failed) toast.error(`${failed} of ${ids.length} could not be removed (still has members assigned)`);
    else toast.success(`${ids.length} department(s) moved to Trash`);
    setSelectedIds(new Set());
    load();
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleIds = departments.map((d) => d.id);
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

  const selectColumn = {
    key: 'select',
    header: (
      <input
        type="checkbox"
        aria-label="Select all visible departments"
        checked={allVisibleSelected}
        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
        onChange={toggleSelectAllVisible}
      />
    ),
    render: (r) => (
      <input
        type="checkbox"
        aria-label={`Select ${r.name}`}
        checked={selectedIds.has(r.id)}
        onChange={() => toggleSelectOne(r.id)}
      />
    ),
  };

  const columns = [
    ...(isSuperAdmin ? [selectColumn] : []),
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'head', header: 'Head', render: (r) => r.head ? `${r.head.firstName} ${r.head.lastName}` : '—' },
    { key: 'count', header: 'Members', render: (r) => r._count?.users ?? 0 },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => openView(r) },
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete (move to Trash)', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  const trashColumns = [
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'count', header: 'Members', render: (r) => r._count?.users ?? 0 },
    { key: 'deletedAt', header: 'Removed Date', render: (r) => r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : '—' },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => openView(r) },
            isSuperAdmin && { key: 'restore', icon: RotateCcw, label: 'Restore', onClick: () => handleRestore(r) },
            isSuperAdmin && { key: 'delete-permanent', icon: Trash2, label: 'Delete Permanently', danger: true, onClick: () => handlePermanentlyDelete(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Organizational units and structure"
        actions={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} strokeWidth={2.5} /> Add Department</button>}
      />

      <div className="stat-grid">
        <StatCard label="Total Departments" value={summary.total} accent="blue" icon={Building2} />
        <StatCard label="Active" value={summary.active} accent="green" icon={CheckCircle2} />
        <StatCard label="Trash" value={summary.trash} accent="red" icon={Trash2} />
      </div>

      {/* Single compact toolbar row, same shared pattern as Employees/
          Interns/Trainees: the Active/All status filter on the left, Trash
          pinned to the far right via .toolbar-actions so it's always the
          last action in the row, never competing with the filter. */}
      <div className="toolbar">
        <span className="search-input-wrap">
          <Search size={16} strokeWidth={2.5} />
          <input className="search-input" placeholder="Search by name or description..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search departments" />
        </span>
        <select value={viewTab === 'trash' ? 'active' : viewTab} onChange={(e) => setViewTab(e.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="toolbar-actions">
          <button type="button" className={`tab ${viewTab === 'trash' ? 'active' : ''}`} onClick={() => setViewTab('trash')}>
            🗑️ Trash{summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}
          </button>
        </div>
      </div>

      {isSuperAdmin && viewTab !== 'trash' && selectedIds.size > 0 && (
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
          rows={departments}
          emptyMessage={viewTab === 'trash' ? 'Trash is empty.' : 'No departments found.'}
        />
      )}

      {showModal && (
        <Modal title="Add Department" onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal size="wide" title={viewing.name} onClose={() => setViewing(null)}>
          <div className="detail-card">
            {viewing.deletedAt && (
              <div className="detail-card-header">
                <Badge value="TERMINATED" label="Removed" />
              </div>
            )}

            {/* Grouped into named sections (same pattern as Employees/
                Interns/Trainees' View modal) instead of one flat grid —
                keeps ID/Description/Head/Members aligned and readable
                instead of an ungrouped list, and the auto-fit .detail-grid
                already collapses columns responsively with no wasted space. */}
            <div className="detail-section">
              <p className="detail-section-title">Department Information</p>
              <div className="detail-grid">
                <DetailField label="ID" value={viewing.id} />
                <DetailField label="Head" value={viewing.head ? `${viewing.head.firstName} ${viewing.head.lastName}` : null} />
                <DetailField label="Members" value={viewing.users ? viewing.users.length : viewing._count?.users ?? 0} />
                {viewing.deletedAt && <DetailField label="Removed Date" value={new Date(viewing.deletedAt).toLocaleString()} />}
                <DetailField full label="Description" value={viewing.description} />
              </div>
            </div>

            {(viewLoading || (viewing.users && viewing.users.length > 0)) && (
              <div className="detail-section">
                <p className="detail-section-title">Team</p>
                {viewLoading ? (
                  <p className="empty-state" style={{ padding: 0, textAlign: 'left' }}>Loading members...</p>
                ) : (
                  <div className="detail-grid">
                    {viewing.users.map((u) => (
                      <DetailField key={u.id} label={u.designation || u.role} value={`${u.firstName} ${u.lastName}`} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit — ${editing.name}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Name<input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
            <label>Description<textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
