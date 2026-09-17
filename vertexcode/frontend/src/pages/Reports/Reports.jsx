import { useState } from 'react';
import {
  Download, Loader2, Users, Clock, FileClock, ListChecks, GraduationCap, BookOpen,
  IndianRupee, MessageSquare, FolderOpen, FileBarChart,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { downloadReport } from '../../lib/download';

// Consolidates the GET /reports/* export endpoints (backend/src/routes/
// report.routes.js — the whole router is Super-Admin-only) into one
// findable page. Previously each of these was only reachable as an
// "Export CSV/Excel" button embedded on its own module page (Employees,
// Attendance, etc.) — those buttons are untouched and still work; this is
// an additional, single home for all of them, not a replacement. No new
// backend endpoint — every path below already existed and is unchanged.
const REPORTS = [
  { key: 'employees', label: 'Employees', description: 'All employee records, including designation, department and status.', icon: Users },
  { key: 'attendance', label: 'Attendance', description: 'Daily clock-in/out and status records across the organization.', icon: Clock },
  { key: 'timesheets', label: 'Timesheets', description: 'Logged hours by project, task and approval status.', icon: FileClock },
  { key: 'tasks', label: 'Tasks', description: 'Task list with assignee, priority, status and due dates.', icon: ListChecks },
  { key: 'interns', label: 'Interns', description: 'Intern enrollments, batches, mentors and completion status.', icon: GraduationCap },
  { key: 'trainees', label: 'Trainees', description: 'Trainee enrollments, programs and payment summaries.', icon: BookOpen },
  { key: 'expenses', label: 'Expenses', description: 'Recorded company expenses by category and date range.', icon: IndianRupee },
  { key: 'enquiries', label: 'Enquiries', description: 'Enquiry pipeline — contact, source, status and assignment.', icon: MessageSquare },
  { key: 'intern-documents', label: 'Intern Documents', description: 'Document submission/verification status per intern (metadata only, not the files).', icon: FolderOpen },
];

export default function Reports() {
  // Tracks which single button (by "key:format") is mid-download, so only
  // that one button shows a spinner/disables — the rest of the page (and
  // the other format button on the same card) stays usable.
  const [pending, setPending] = useState(null);

  const handleExport = async (key, format) => {
    const id = `${key}:${format}`;
    setPending(id);
    try {
      await downloadReport(
        format === 'xlsx' ? `/reports/${key}?format=xlsx` : `/reports/${key}`,
        `${key}.${format}`
      );
    } catch {
      // downloadReport already surfaced a toast — nothing further to do here.
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Download CSV or Excel exports of core records — Super Admin only"
      />
      <div className="card-grid">
        {REPORTS.map((r) => (
          <div className="card" key={r.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <r.icon size={18} strokeWidth={2.5} />
              <h3 style={{ margin: 0 }}>{r.label}</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 14px' }}>{r.description}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                disabled={pending === `${r.key}:csv`}
                onClick={() => handleExport(r.key, 'csv')}
              >
                {pending === `${r.key}:csv` ? <Loader2 size={16} strokeWidth={2.5} className="spin" /> : <Download size={16} strokeWidth={2.5} />}
                Export CSV
              </button>
              <button
                className="btn btn-secondary"
                disabled={pending === `${r.key}:xlsx`}
                onClick={() => handleExport(r.key, 'xlsx')}
              >
                {pending === `${r.key}:xlsx` ? <Loader2 size={16} strokeWidth={2.5} className="spin" /> : <Download size={16} strokeWidth={2.5} />}
                Export Excel
              </button>
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <FileBarChart size={14} /> Every export here is also available as an "Export" button directly on its own module page.
      </p>
    </div>
  );
}
