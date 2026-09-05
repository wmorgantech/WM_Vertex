import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import TableActions from '../../components/common/TableActions';
import DetailField from '../../components/common/DetailField';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

const LINK_TYPE_LABELS = { USER: 'Employee', WORKSHOP: 'Workshop', MOU: 'MOU', PROJECT: 'Project' };

const EMPTY_FORM = {
  categoryCode: '', title: '', description: '', amount: '', expenseDate: '',
  paymentMode: '', vendor: '', reference: '', linkType: '', linkId: '',
};

export default function Expenses() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  // Read-only self-service view — Employee can only ever see their own
  // USER-linked expenses (enforced server-side in expense.controller.js,
  // not just by hiding controls here). No create/edit/delete/export/summary.
  const isEmployee = user.role === 'EMPLOYEE';
  const [viewing, setViewing] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [mous, setMous] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ categoryCode: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {
      ...(filters.categoryCode && { categoryCode: filters.categoryCode }),
      ...(filters.from && { from: filters.from }),
      ...(filters.to && { to: filters.to }),
    };
    // Employee's view is read-only and always scoped to their own USER-linked
    // records server-side — summary and the workshop/MOU/project/user lookups
    // only exist to support Admin's create/edit "Link To" picker and the
    // Super-Admin-only summary cards, neither of which Employee has.
    const calls = isEmployee
      ? [api.get('/expenses', { params }), api.get('/masters/expense-categories')]
      : [
          api.get('/expenses', { params }),
          api.get('/expenses/summary', { params }),
          api.get('/masters/expense-categories'),
          api.get('/users'),
          api.get('/workshops'),
          api.get('/mous'),
          api.get('/projects'),
        ];
    Promise.all(calls).then(([e, ...rest]) => {
      setExpenses(e.data.data);
      if (isEmployee) {
        const [c] = rest;
        setCategories(c.data.data.filter((cat) => cat.active));
      } else {
        const [s, c, u, w, m, p] = rest;
        setSummary(s.data.data);
        setCategories(c.data.data.filter((cat) => cat.active));
        setUsers(u.data.data);
        setWorkshops(w.data.data);
        setMous(m.data.data);
        setProjects(p.data.data);
      }
    }).finally(() => setLoading(false));
  };
  useEffect(load, [filters]);

  const linkOptions = (linkType) => {
    if (linkType === 'USER') return users.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }));
    if (linkType === 'WORKSHOP') return workshops.map((w) => ({ id: w.id, label: w.topic }));
    if (linkType === 'MOU') return mous.map((m) => ({ id: m.id, label: `${m.mouType || 'MOU'} — ${m.college?.name || ''}` }));
    if (linkType === 'PROJECT') return projects.map((p) => ({ id: p.id, label: p.name }));
    return [];
  };

  const linkedLabel = (row) => {
    if (!row.linkType || !row.linkId) return '—';
    const opt = linkOptions(row.linkType).find((o) => o.id === row.linkId);
    return `${LINK_TYPE_LABELS[row.linkType]}: ${opt?.label || row.linkId}`;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      categoryCode: row.categoryCode,
      title: row.title,
      description: row.description || '',
      amount: row.amount,
      expenseDate: new Date(row.expenseDate).toISOString().slice(0, 10),
      paymentMode: row.paymentMode || '',
      vendor: row.vendor || '',
      reference: row.reference || '',
      linkType: row.linkType || '',
      linkId: row.linkId || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      linkType: form.linkType || null,
      linkId: form.linkType ? form.linkId : null,
    };
    try {
      if (editing) {
        await api.put(`/expenses/${editing.id}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense recorded');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove "${row.title}"?`)) return;
    try {
      await api.delete(`/expenses/${row.id}`);
      toast.success('Expense removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove expense');
    }
  };

  const columns = isEmployee ? [
    { key: 'expenseDate', header: 'Date', render: (r) => new Date(r.expenseDate).toLocaleDateString() },
    { key: 'category', header: 'Category', render: (r) => <Badge value={r.category.code} /> },
    { key: 'title', header: 'Title' },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => `₹${r.amount.toLocaleString()}` },
    { key: 'vendor', header: 'Vendor', render: (r) => r.vendor || '—' },
    { key: 'recordedBy', header: 'Recorded By', render: (r) => `${r.recordedBy.firstName} ${r.recordedBy.lastName}` },
    {
      key: 'actions', header: '', align: 'actions', render: (r) => (
        <TableActions actions={[{ key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) }]} />
      ),
    },
  ] : [
    { key: 'expenseDate', header: 'Date', render: (r) => new Date(r.expenseDate).toLocaleDateString() },
    { key: 'category', header: 'Category', render: (r) => <Badge value={r.category.code} /> },
    { key: 'title', header: 'Title' },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => `₹${r.amount.toLocaleString()}` },
    { key: 'vendor', header: 'Vendor', render: (r) => r.vendor || '—' },
    { key: 'linked', header: 'Linked To', render: linkedLabel },
    { key: 'recordedBy', header: 'Recorded By', render: (r) => `${r.recordedBy.firstName} ${r.recordedBy.lastName}` },
    {
      key: 'actions', header: 'Actions', align: 'actions', render: (r) => (
        <TableActions
          actions={[
            { key: 'view', icon: Eye, label: 'View', onClick: () => setViewing(r) },
            { key: 'edit', icon: Pencil, label: 'Edit', onClick: () => openEdit(r) },
            isSuperAdmin && { key: 'trash', icon: Trash2, label: 'Delete', danger: true, onClick: () => handleDelete(r) },
          ]}
        />
      ),
    },
  ];

  const exportFilterParams = {
    ...(filters.categoryCode && { categoryCode: filters.categoryCode }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
  };

  return (
    <div>
      <PageHeader
        title={isEmployee ? 'My Expenses' : 'Expenses'}
        subtitle={isEmployee ? 'Expenses recorded against your name' : 'All actual company spending — salaries, travel, office, workshops/events and other operational costs'}
        actions={isEmployee ? null : (
          <>
            {isSuperAdmin && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport(`/reports/expenses?${new URLSearchParams(exportFilterParams)}`, 'expenses.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport(`/reports/expenses?${new URLSearchParams({ ...exportFilterParams, format: 'xlsx' })}`, 'expenses.xlsx')}>Export Excel</button>
              </>
            )}
            <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Expense</button>
          </>
        )}
      />

      {summary && (
        <div className="stat-grid">
          <StatCard label="Total Expenses" value={`₹${summary.total.toLocaleString()}`} hint={`${summary.count} record(s)`} accent="blue" />
          <StatCard label="Last 30 Days" value={`₹${summary.last30Days.toLocaleString()}`} accent="amber" />
          {summary.byCategory.filter((c) => c.total > 0).slice(0, 4).map((c) => (
            <StatCard key={c.code} label={c.label} value={`₹${c.total.toLocaleString()}`} accent="gray" />
          ))}
        </div>
      )}

      <div className="toolbar">
        <select value={filters.categoryCode} onChange={(e) => setFilters({ ...filters, categoryCode: e.target.value })}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} title="From date" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} title="To date" />
        {(filters.categoryCode || filters.from || filters.to) && (
          <button className="btn btn-ghost" onClick={() => setFilters({ categoryCode: '', from: '', to: '' })}>Clear Filters</button>
        )}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : (
        <DataTable columns={columns} rows={expenses} emptyMessage="No expenses recorded yet." />
      )}

      {viewing && (
        <Modal size="wide" title={viewing.title} onClose={() => setViewing(null)}>
          <div className="detail-card">
            <div className="detail-card-header">
              <Badge value={viewing.category.code} />
              <span className="detail-field-value">₹{viewing.amount.toLocaleString()}</span>
            </div>
            <div className="detail-grid">
              <DetailField label="Date" value={new Date(viewing.expenseDate).toLocaleDateString()} />
              <DetailField label="Payment Mode" value={viewing.paymentMode} />
              <DetailField label="Vendor" value={viewing.vendor} />
              <DetailField label="Reference" value={viewing.reference} />
              {!isEmployee && <DetailField label="Linked To" value={linkedLabel(viewing)} />}
              <DetailField label="Recorded By" value={`${viewing.recordedBy.firstName} ${viewing.recordedBy.lastName}`} />
              <DetailField full label="Description" value={viewing.description} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Expense' : 'Record Expense'} onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleSave}>
            <label>Category
              <select required value={form.categoryCode} onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}>
                <option value="">Select category...</option>
                {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Amount (₹)<input type="number" required min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label>Expense Date<input type="date" required value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></label>
            <label>Payment Mode<input placeholder="e.g. Bank Transfer, UPI, Cash" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} /></label>
            <label>Vendor<input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
            <label>Reference<input placeholder="Invoice / transaction ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
            <label>Link To
              <select value={form.linkType} onChange={(e) => setForm({ ...form, linkType: e.target.value, linkId: '' })}>
                <option value="">— None —</option>
                {Object.entries(LINK_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            {form.linkType && (
              <label>{LINK_TYPE_LABELS[form.linkType]}
                <select required value={form.linkId} onChange={(e) => setForm({ ...form, linkId: e.target.value })}>
                  <option value="">Select...</option>
                  {linkOptions(form.linkType).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Record Expense'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
