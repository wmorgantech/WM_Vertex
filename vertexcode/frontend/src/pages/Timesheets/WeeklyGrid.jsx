import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, TriangleAlert, Check, Pencil, X as XIcon, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../../api/axios';
import Badge from '../../components/common/Badge';
import SummaryCards from './SummaryCards';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { toIsoDate, parseIsoDate, mondayOf, addDays, weekDays, formatWeekRange, dayLabel, TIMESHEET_STATUS_LABELS } from './weekUtils';

function rowKey(position) {
  return position || 'none';
}

// Stable React key per grid row, independent of Position — a row's
// identity must survive the user changing the dropdown in place, so it
// can't be derived from rowKey() (see setPosition).
let rowKeySeq = 0;
function genRowKey() {
  rowKeySeq += 1;
  return `row-${Date.now().toString(36)}-${rowKeySeq}`;
}

function clampHours(n) {
  return Math.round(Math.max(0, n) * 100) / 100;
}

// Groups the flat Timesheet rows returned by /timesheets/summary into grid
// rows keyed by Position — one row = one Position, with a daily hour cell
// per day. Project/Task are legacy-only on the model (kept for historical
// records — see timesheet.controller.js) and have no column in this UI;
// an entry that happens to carry a projectId from before keeps it
// untouched server-side, this view just doesn't show or edit it.
function buildRowsFromEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = rowKey(e.position);
    if (!map.has(key)) {
      map.set(key, {
        key: genRowKey(),
        position: e.position || null,
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
  // Editing an already-APPROVED week is a distinct, explicit mode the owner
  // opts into via the Edit button — never a side effect of the row/status
  // being editable in the DB sense. It never touches the persisted status by
  // itself; only actually saving (Save & Re-submit) does that, server-side.
  const [editingApproved, setEditingApproved] = useState(false);
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
        setEditingApproved(false); // a fresh fetch always reflects the true persisted state
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [from, to, userId]);

  // Position dropdown is sourced from the existing Designation master —
  // same one Super Admin manages under Configuration → Master Data — not a
  // new master table.
  useEffect(() => {
    api.get('/masters/designations').then(({ data }) => setPositions(data.data.filter((d) => d.active)));
  }, []);

  // Explicitly re-opening an APPROVED week (editingApproved) is the one
  // case that overrides the normal lock — everything else about "locked"
  // (readOnly manager view, a SUBMITTED week awaiting review) still applies.
  const canEditApproved = !readOnly && summary?.status === 'APPROVED';
  const locked = (readOnly || ['SUBMITTED', 'APPROVED'].includes(summary?.status)) && !(canEditApproved && editingApproved);
  const isCurrentWeek = toIsoDate(monday) === toIsoDate(mondayOf(new Date()));
  // No dedicated "Actions" column — just a slim, unlabeled trailing column
  // holding the delete icon. Excluded during editingApproved same as the
  // "Add Assignment" button below: correcting an approved week is scoped
  // to adjusting existing rows' hours/position/project, not adding or
  // removing whole rows.
  const canDeleteRows = !readOnly && !locked && !editingApproved;

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

  // Backs the Position dropdown. A row is identified for saving purposes by
  // Position — see buildRowsFromEntries — so changing it on an existing row
  // must be blocked if it would collide with another row already using
  // that Position this week (they'd silently merge into one row on the
  // next reload otherwise).
  const setPosition = (idx, rawValue) => {
    const value = rawValue || null;
    setRows((prev) => {
      const newKey = rowKey(value);
      const collides = prev.some((r, i) => i !== idx && rowKey(r.position) === newKey);
      if (collides) {
        toast.error('A row for this Position already exists this week');
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...prev[idx], position: value };
      return next;
    });
  };

  const removeRow = async (rIdx) => {
    const row = rows[rIdx];
    const label = row.position || 'unassigned';
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
    const existingKeys = new Set(rows.map((r) => rowKey(r.position)));
    const ownPosition = authUser.designation;
    const defaultPosition = ownPosition && !existingKeys.has(rowKey(ownPosition)) ? ownPosition : null;
    if (existingKeys.has(rowKey(defaultPosition))) {
      toast.error('An unassigned row already exists — set its position before adding another');
      return;
    }
    setRows((prev) => [...prev, { key: genRowKey(), position: defaultPosition, description: '', cells: {} }]);
  };

  // Direct editing for Draft/Rejected (and, once opted into via "Request
  // Re-edit", an Approved week too) — a row's editability follows the
  // week-level lock state alone. There is deliberately no separate
  // per-row "click Edit first" step; that used to require re-toggling
  // every row individually after each save, which fought normal Draft
  // editing.
  const rowEditable = (row) => !readOnly && !locked;

  const buildEntries = () => {
    const entries = [];
    for (const row of rows) {
      for (const iso of dayIsos) {
        const cell = row.cells[iso];
        const hours = Number(cell?.hoursLogged) || 0;
        if (!cell?.id && hours <= 0) continue; // never existed, still empty — nothing to send
        // No projectId sent — this view no longer edits it. The backend
        // only overwrites projectId when the key is present at all, so
        // omitting it leaves an existing entry's project untouched and a
        // brand-new entry gets created with none.
        entries.push({
          id: cell?.id,
          date: iso,
          position: row.position,
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

  // Discards any in-progress edits by simply re-fetching the last-saved
  // (still-APPROVED) state — nothing was ever sent to the server, so there
  // is nothing to undo server-side.
  const cancelEditApproved = () => {
    setEditingApproved(false);
    load();
  };

  // A single combined action, matching how an approved week is reviewed as
  // one unit: /timesheets/bulk already demotes any touched APPROVED row to
  // PENDING server-side (see timesheet.controller.js), so no separate
  // /timesheets/submit call is needed or possible here (that endpoint only
  // looks at DRAFT/REJECTED entries, which these no longer are).
  const saveAndResubmit = async () => {
    setSubmitting(true);
    try {
      await api.post('/timesheets/bulk', { entries: buildEntries() });
      toast.success('Timesheet updated and re-submitted for approval');
      setEditingApproved(false);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes');
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
          <button className="btn-today" disabled={isCurrentWeek} onClick={() => setMonday(mondayOf(new Date()))}>Today</button>
          <button className="btn btn-ghost btn-icon" onClick={() => setMonday((m) => addDays(m, 7))} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {canEditApproved && editingApproved && (
        <div className="ts-edit-banner">
          <strong>Editing an approved timesheet</strong>
          <span>Any changes will require re-submission for approval.</span>
        </div>
      )}

      {summary && (() => {
        const diff = weekTotal - summary.expectedHours;
        return (
          <SummaryCards items={[
            { label: 'Expected', value: `${summary.expectedHours.toFixed(2)}h`, icon: Clock, accent: 'blue' },
            {
              label: 'Difference',
              value: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}h`,
              icon: diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus,
              accent: diff > 0 ? 'green' : diff < 0 ? 'amber' : 'gray',
            },
            { label: 'Working Days', value: summary.workingDays, icon: Calendar, accent: 'purple' },
          ]} />
        );
      })()}

      {!locked && !editingApproved && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={addRow}>
            <Plus size={14} /> Add Assignment
          </button>
        </div>
      )}

      <div className="table-wrap sticky-header timesheet-grid">
        <table className="data-table">
          <colgroup>
            <col className="timesheet-position-col" />
            {dayIsos.map((iso) => <col key={iso} className="timesheet-day-col" />)}
            <col className="timesheet-total-col" />
            {canDeleteRows && <col className="timesheet-actions-col" />}
          </colgroup>
          <thead>
            <tr>
              <th className="col-sticky col-group-end" style={{ minWidth: 165 }}>Position</th>
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
              {canDeleteRows && <th className="col-actions" aria-hidden="true"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={canDeleteRows ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
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
                      disabled={!rowEditable(row)}
                      aria-label="Position"
                      title={row.position || ''}
                      value={row.position || ''}
                      onChange={(e) => setPosition(rIdx, e.target.value)}
                    >
                      <option value="">Select Position</option>
                      {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                      {row.position && !positions.some((p) => p.name === row.position) && (
                        <option value={row.position}>{row.position}</option>
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
                        disabled={!rowEditable(row)}
                        value={row.cells[iso]?.hoursLogged ?? ''}
                        placeholder={locked ? '—' : '0.00'}
                        onChange={(e) => setCell(rIdx, iso, e.target.value)}
                        onBlur={(e) => formatCellOnBlur(rIdx, iso, e.target.value)}
                        aria-label={`${dayLabel(iso)} hours for ${row.position || 'this row'}`}
                      />
                    </td>
                  ))}
                  <td className="col-num col-total-cell">{rowTotal.toFixed(2)}</td>
                  {canDeleteRows && (
                    <td className="col-actions">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeRow(rIdx)} aria-label="Remove row" title="Remove row">
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
                <td className="col-group-end">Weekly Total</td>
                {dayIsos.map((iso) => (
                  <td key={iso} className={`col-num${iso === todayIso ? ' col-today' : ''}`}>{liveDayTotals[iso].toFixed(2)}</td>
                ))}
                <td className="col-num col-total-cell">{weekTotal.toFixed(2)}</td>
                {canDeleteRows && <td className="col-actions"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Weekly Submission Status, below the table — one badge, plus the
          rejection reason inline when there is one. Replaces the old
          "This week has been approved/submitted" prose sentence, which
          said nothing the badge doesn't already say. */}
      {summary && (() => {
        const rejectReasons = summary.status === 'REJECTED'
          ? [...new Set(summary.entries.filter((e) => e.status === 'REJECTED' && e.rejectionReason).map((e) => e.rejectionReason))]
          : [];
        return (
          <div className="ts-status-row">
            <span className="ts-status-label">Status</span>
            <Badge value={summary.status} label={TIMESHEET_STATUS_LABELS[summary.status]} />
            {rejectReasons.length > 0 && <span className="ts-status-reason">{rejectReasons.join(' · ')}</span>}
          </div>
        );
      })()}

      {!readOnly && (editingApproved || !locked || canEditApproved) && (
        <div className="form-actions" style={{ marginTop: 12 }}>
          {editingApproved ? (
            <>
              <button className="btn btn-ghost" disabled={submitting} onClick={cancelEditApproved}>
                <XIcon size={14} /> Cancel
              </button>
              <button className="btn btn-primary" disabled={submitting || rows.length === 0} onClick={saveAndResubmit}>
                {submitting ? 'Saving...' : (<><Check size={14} /> Save &amp; Re-submit</>)}
              </button>
            </>
          ) : locked ? (
            canEditApproved && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingApproved(true)}>
                <Pencil size={13} /> Request Re-edit
              </button>
            )
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
