import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, TriangleAlert, Check } from 'lucide-react';
import api from '../../api/axios';
import Badge from '../../components/common/Badge';
import SummaryCards from './SummaryCards';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { toIsoDate, parseIsoDate, mondayOf, addDays, weekDays, formatWeekRange, dayLabel, TIMESHEET_STATUS_LABELS } from './weekUtils';

function rowKey(position, projectId) {
  return `${position || 'none'}::${projectId || 'none'}`;
}

// Stable React key per grid row, independent of Position/Project — a row's
// identity must survive the user changing either dropdown in place, so it
// can't be derived from rowKey() (see setRowField).
let rowKeySeq = 0;
function genRowKey() {
  rowKeySeq += 1;
  return `row-${Date.now().toString(36)}-${rowKeySeq}`;
}

function clampHours(n) {
  return Math.round(Math.max(0, n) * 100) / 100;
}

// Groups the flat Timesheet rows returned by /timesheets/summary into grid
// rows keyed by (Position, Project) — one row = one Position/Project
// allocation, with a daily hour cell per day. Task is legacy only (kept on
// the model for historical records — see timesheet.controller.js) and has
// no column in this UI.
function buildRowsFromEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = rowKey(e.position, e.projectId);
    if (!map.has(key)) {
      map.set(key, {
        key: genRowKey(),
        position: e.position || null,
        projectId: e.projectId || null,
        projectName: e.project?.name || '',
        description: e.description || '',
        cells: {},
      });
    }
    const row = map.get(key);
    const iso = e.date.slice(0, 10);
    // Formatted to 2 decimals here too (not just on blur) so a value loaded
    // fresh from the server ("8") displays the same as one just typed and
    // blurred ("8.00") — consistent display regardless of where it came from.
    row.cells[iso] = { id: e.id, hoursLogged: Number(e.hoursLogged).toFixed(2) };
    if (e.description) row.description = e.description;
  }
  return [...map.values()];
}

function ManagerReviewActions({ entries, onDone }) {
  const [acting, setActing] = useState(false);
  const pendingIds = entries.filter((e) => e.status === 'PENDING').map((e) => e.id);

  const approve = async () => {
    setActing(true);
    try {
      await api.patch('/timesheets/bulk/approve', { ids: pendingIds });
      toast.success('Timesheet approved');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason || !reason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    setActing(true);
    try {
      await api.patch('/timesheets/bulk/reject', { ids: pendingIds, reason });
      toast.success('Timesheet rejected');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setActing(false);
    }
  };

  // Authorization only — Approve/Reject never touch the employee's hours;
  // there is deliberately no Edit action here (see timesheet.controller.js's
  // approveOne/rejectOne, which never write hoursLogged).
  return (
    <div className="form-actions" style={{ marginTop: 20 }}>
      <button className="btn btn-danger" disabled={acting} onClick={reject}><TriangleAlert size={14} /> Reject</button>
      <button className="btn btn-success" disabled={acting} onClick={approve}><CheckCircle2 size={14} /> Approve</button>
    </div>
  );
}

export default function WeeklyGrid({ userId, readOnly = false, onChanged, initialMonday }) {
  const { user: authUser } = useAuth();
  // `initialMonday` (e.g. from Monthly's "View") only seeds the first
  // render — WeeklyGrid unmounts/remounts on every Weekly<->Monthly tab
  // switch in Timesheets.jsx, so this always picks up the latest jump.
  const [monday, setMonday] = useState(() => mondayOf(initialMonday || new Date()));
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [positions, setPositions] = useState([]);
  const [projects, setProjects] = useState([]);
  const dateInputRef = useRef(null);
  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  const days = useMemo(() => weekDays(monday), [monday]);
  const dayIsos = useMemo(() => days.map(toIsoDate), [days]);
  const from = dayIsos[0];
  const to = dayIsos[6];
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const load = () => {
    setLoading(true);
    const params = { from, to, ...(userId && { userId }) };
    api.get('/timesheets/summary', { params })
      .then(({ data }) => {
        setSummary(data.data);
        setRows(buildRowsFromEntries(data.data.entries));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [from, to, userId]);

  // Position dropdown is sourced from the existing Designation master —
  // same one Super Admin manages under Configuration → Master Data — not a
  // new master table. Project reuses the existing Projects list/API.
  useEffect(() => {
    api.get('/masters/designations').then(({ data }) => setPositions(data.data.filter((d) => d.active)));
    api.get('/projects').then(({ data }) => setProjects(data.data));
  }, []);

  const locked = readOnly || ['SUBMITTED', 'APPROVED'].includes(summary?.status);

  const liveDayTotals = useMemo(() => {
    const totals = {};
    for (const iso of dayIsos) totals[iso] = 0;
    for (const row of rows) {
      for (const iso of dayIsos) {
        totals[iso] += Number(row.cells[iso]?.hoursLogged) || 0;
      }
    }
    return totals;
  }, [rows, dayIsos]);

  const weekTotal = Object.values(liveDayTotals).reduce((s, v) => s + v, 0);

  const setCell = (rIdx, iso, value) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rIdx], cells: { ...next[rIdx].cells } };
      row.cells[iso] = { ...(row.cells[iso] || {}), hoursLogged: value };
      next[rIdx] = row;
      return next;
    });
  };

  // Normalizes a day cell to a clean 2-decimal string on blur — "9", "9.0"
  // and "9.00" all end up displayed as "9.00". Typing itself is untouched
  // (raw keystrokes go straight through setCell) so this never fights the
  // user mid-edit or breaks Tab-to-next-field.
  const formatCellOnBlur = (rIdx, iso, rawValue) => {
    if (rawValue === '') return;
    const n = Number(rawValue);
    setCell(rIdx, iso, Number.isNaN(n) ? '' : clampHours(n).toFixed(2));
  };

  // Backs the Position/Project dropdowns. A row is identified for saving
  // purposes by (Position, Project) — see buildRowsFromEntries — so
  // changing either on an existing row must be blocked if it would collide
  // with another row already using that same pair this week (they'd
  // silently merge into one row on the next reload otherwise).
  const setRowField = (idx, field, rawValue) => {
    const value = rawValue || null;
    setRows((prev) => {
      const current = prev[idx];
      const nextPosition = field === 'position' ? value : current.position;
      const nextProjectId = field === 'projectId' ? value : current.projectId;
      const newKey = rowKey(nextPosition, nextProjectId);
      const collides = prev.some((r, i) => i !== idx && rowKey(r.position, r.projectId) === newKey);
      if (collides) {
        toast.error('A row for this Position/Project combination already exists this week');
        return prev;
      }
      const project = projects.find((p) => p.id === nextProjectId);
      const next = [...prev];
      next[idx] = {
        ...current,
        position: nextPosition,
        projectId: nextProjectId,
        projectName: nextProjectId ? (project?.name || current.projectName) : '',
      };
      return next;
    });
  };

  const removeRow = async (rIdx) => {
    const row = rows[rIdx];
    const label = [row.position, row.projectName].filter(Boolean).join(' — ') || 'unassigned';
    if (!window.confirm(`Remove all "${label}" entries for this week?`)) return;
    const idsToDelete = Object.values(row.cells).map((c) => c.id).filter(Boolean);
    try {
      await Promise.all(idsToDelete.map((id) => api.delete(`/timesheets/${id}`)));
      setRows((prev) => prev.filter((_, i) => i !== rIdx));
      toast.success('Row removed');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove row');
    }
  };

  // Adds a new row directly into the grid, already editable — no modal.
  // Defaults Position to the employee's own designation (the common case)
  // unless that row already exists, in which case it falls back to blank.
  // Only one blank row is ever allowed at a time, so two never silently
  // merge into one on the next reload (see buildRowsFromEntries).
  const addRow = () => {
    const existingKeys = new Set(rows.map((r) => rowKey(r.position, r.projectId)));
    const ownPosition = authUser.designation;
    const defaultPosition = ownPosition && !existingKeys.has(rowKey(ownPosition, null)) ? ownPosition : null;
    if (existingKeys.has(rowKey(defaultPosition, null))) {
      toast.error('An unassigned row already exists — set its position/project before adding another');
      return;
    }
    setRows((prev) => [...prev, { key: genRowKey(), position: defaultPosition, projectId: null, projectName: '', description: '', cells: {} }]);
  };

  const buildEntries = () => {
    const entries = [];
    for (const row of rows) {
      for (const iso of dayIsos) {
        const cell = row.cells[iso];
        const hours = Number(cell?.hoursLogged) || 0;
        if (!cell?.id && hours <= 0) continue; // never existed, still empty — nothing to send
        entries.push({
          id: cell?.id,
          date: iso,
          position: row.position,
          projectId: row.projectId,
          hoursLogged: hours,
          description: row.description,
        });
      }
    }
    return entries;
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await api.post('/timesheets/bulk', { entries: buildEntries() });
      toast.success('Draft saved');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const submitWeek = async () => {
    setSubmitting(true);
    try {
      await api.post('/timesheets/bulk', { entries: buildEntries() });
      await api.post('/timesheets/submit', { from, to });
      toast.success('Timesheet submitted for review');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit timesheet');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) return <div className="page-loading">Loading...</div>;

  return (
    <div>
      <div className="ts-header-block">
        <div className="ts-header-row">
          <h2 className="ts-period-heading">{formatWeekRange(monday, 6)}</h2>
          {summary && <Badge value={summary.status} label={TIMESHEET_STATUS_LABELS[summary.status]} />}
        </div>
        <div className="ts-nav-group">
          <button className="btn btn-ghost btn-icon" onClick={openDatePicker} aria-label="Pick a date">
            <Calendar size={15} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="ts-hidden-date-input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => { if (e.target.value) setMonday(mondayOf(parseIsoDate(e.target.value))); }}
          />
          <button className="btn btn-ghost btn-icon" onClick={() => setMonday((m) => addDays(m, -7))} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <button className="btn-today" onClick={() => setMonday(mondayOf(new Date()))}>Today</button>
          <button className="btn btn-ghost btn-icon" onClick={() => setMonday((m) => addDays(m, 7))} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {summary?.status === 'REJECTED' && (() => {
        const reasons = [...new Set(
          summary.entries.filter((e) => e.status === 'REJECTED' && e.rejectionReason).map((e) => e.rejectionReason)
        )];
        if (reasons.length === 0) return null;
        return (
          <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>Rejected:</strong> {reasons.join(' · ')}
          </div>
        );
      })()}

      {summary && (() => {
        const diff = weekTotal - summary.expectedHours;
        return (
          <SummaryCards items={[
            { label: 'Expected', value: `${summary.expectedHours.toFixed(2)}h` },
            { label: 'Actual', value: `${weekTotal.toFixed(2)}h` },
            {
              label: 'Difference',
              value: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}h`,
              tone: diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral',
            },
            { label: 'Working Days', value: summary.workingDays },
          ]} />
        );
      })()}

      <div className="table-wrap sticky-header timesheet-grid">
        <table className="data-table">
          <thead>
            <tr className="col-super-row">
              <th colSpan={2} className="col-super-label">Work Assignment</th>
              <th colSpan={dayIsos.length + 1 + (locked ? 0 : 1)}></th>
            </tr>
            <tr>
              <th className="col-sticky col-group-end" style={{ minWidth: 165 }}>Role / Position</th>
              <th className="col-group-end" style={{ minWidth: 155 }}>Project</th>
              {dayIsos.map((iso) => {
                const dow = parseIsoDate(iso).getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <th key={iso} className={`col-num${iso === todayIso ? ' col-today' : ''}`} style={{ minWidth: 64 }}>
                    <div className={`day-head${isWeekend ? ' day-head-weekend' : ''}`}>
                      <span className="day-head-name">{dayLabel(iso)}</span>
                      <span className="day-head-date">{parseIsoDate(iso).getDate()}</span>
                    </div>
                  </th>
                );
              })}
              <th className="col-num col-total-head">Total</th>
              {!locked && <th className="col-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={locked ? 10 : 11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  No entries yet this week.
                </td>
              </tr>
            )}
            {rows.map((row, rIdx) => {
              const rowTotal = dayIsos.reduce((s, iso) => s + (Number(row.cells[iso]?.hoursLogged) || 0), 0);
              return (
                <tr key={row.key}>
                  <td className="col-sticky col-group-end">
                    <select
                      disabled={locked}
                      aria-label="Role / Position"
                      title={row.position || ''}
                      value={row.position || ''}
                      onChange={(e) => setRowField(rIdx, 'position', e.target.value)}
                    >
                      <option value="">Select Position</option>
                      {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                      {row.position && !positions.some((p) => p.name === row.position) && (
                        <option value={row.position}>{row.position}</option>
                      )}
                    </select>
                  </td>
                  <td className="col-group-end">
                    <select
                      disabled={locked}
                      aria-label="Project"
                      title={row.projectName || ''}
                      value={row.projectId || ''}
                      onChange={(e) => setRowField(rIdx, 'projectId', e.target.value)}
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      {row.projectId && !projects.some((p) => p.id === row.projectId) && (
                        <option value={row.projectId}>{row.projectName || row.projectId}</option>
                      )}
                    </select>
                  </td>
                  {dayIsos.map((iso) => (
                    <td key={iso} className={`col-num${iso === todayIso ? ' col-today' : ''}`}>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        className="hour-input"
                        disabled={locked}
                        value={row.cells[iso]?.hoursLogged ?? ''}
                        placeholder={locked ? '—' : '0.00'}
                        onChange={(e) => setCell(rIdx, iso, e.target.value)}
                        onBlur={(e) => formatCellOnBlur(rIdx, iso, e.target.value)}
                        aria-label={`${dayLabel(iso)} hours for ${row.position || 'this row'}`}
                      />
                    </td>
                  ))}
                  <td className="col-num col-total-cell">{rowTotal.toFixed(2)}</td>
                  {!locked && (
                    <td className="col-actions">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeRow(rIdx)} aria-label="Remove row">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="ts-weekly-total-row">
                <td colSpan={2} className="col-group-end">Weekly Total</td>
                {dayIsos.map((iso) => (
                  <td key={iso} className={`col-num${iso === todayIso ? ' col-today' : ''}`}>{liveDayTotals[iso].toFixed(2)}</td>
                ))}
                <td className="col-num col-total-cell">{weekTotal.toFixed(2)}</td>
                {!locked && <td className="col-actions"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!locked && (
        <button className="btn-add-row-subtle" onClick={addRow}>
          <Plus size={13} /> Add another row
        </button>
      )}

      {!readOnly && (
        <div className="form-actions" style={{ marginTop: 20 }}>
          {locked ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              {summary?.status === 'APPROVED' ? 'This week has been approved.' : 'This week has been submitted and is waiting for approval.'}
            </p>
          ) : (
            <>
              <button className="btn btn-secondary" disabled={saving || submitting} onClick={saveDraft}>
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button className="btn btn-primary" disabled={saving || submitting || rows.length === 0} onClick={submitWeek}>
                {submitting ? 'Submitting...' : (<><Check size={14} /> Submit</>)}
              </button>
            </>
          )}
        </div>
      )}

      {readOnly && summary?.status === 'SUBMITTED' && (
        <ManagerReviewActions entries={summary.entries} onDone={() => { load(); onChanged?.(); }} />
      )}
    </div>
  );
}
