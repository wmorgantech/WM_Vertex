import { useEffect, useState } from 'react';
import { FolderKanban, ListChecks, Star, Clock3, Users } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import SimplePieChart from '../../components/charts/SimplePieChart';

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [team, setTeam] = useState([]);
  const [interns, setInterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/analytics/overview'), api.get('/analytics/team'), api.get('/analytics/interns')])
      .then(([o, t, i]) => { setOverview(o.data.data); setTeam(t.data.data); setInterns(i.data.data); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading analytics...</div>;
  if (loadError || !overview) return <p className="empty-state">Analytics data failed to load. Please refresh the page.</p>;

  const teamColumns = [
    { key: 'user', header: 'Name', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'role', header: 'Role', render: (r) => r.user.role },
    { key: 'taskCompletionRate', header: 'Task Completion', render: (r) => `${r.taskCompletionRate}%` },
    { key: 'attendanceDaysLast30', header: 'Attendance (30d)', render: (r) => r.attendanceDaysLast30 },
    { key: 'hoursLoggedLast30', header: 'Hours Logged (30d)', render: (r) => r.hoursLoggedLast30 },
  ];

  // Task-status breakdown already has a dedicated chart on the Dashboard —
  // showing the exact same org-wide split again here would be a duplicate,
  // not a distinct "productivity" insight, so it isn't repeated on this
  // page. Intern Program Status (completionStatus, not task status) is a
  // different dimension, not shown anywhere else — kept.
  const internStatusData = Object.entries(interns.byStatus).map(([status, count]) => ({ status: status.replace(/_/g, ' '), count }));

  return (
    <div>
      <PageHeader title="Productivity Analytics" subtitle="Team performance, completion metrics and utilization trends" />

      <div className="stat-grid">
        <StatCard label="Active Projects" value={overview.projects.activeProjects} accent="blue" icon={FolderKanban} />
        <StatCard label="Total Tasks" value={overview.tasks.total} accent="gray" icon={ListChecks} />
        <StatCard label="Avg. Intern Rating" value={interns.averagePerformanceRating ?? '—'} accent="purple" icon={Star} />
        <StatCard
          label="Pending Approvals"
          value={overview.pendingApprovals.timesheets + overview.pendingApprovals.workUpdates}
          hint="Timesheets + Work Updates awaiting review"
          accent="amber"
          icon={Clock3}
        />
      </div>

      <div className="card-grid">
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} strokeWidth={2.5} /> Intern Program Status</h3>
          {internStatusData.length > 0 ? (
            <SimplePieChart data={internStatusData} dataKey="count" nameKey="status" />
          ) : (
            <p className="empty-state" style={{ padding: '32px 0' }}>No intern enrollments yet.</p>
          )}
        </div>
      </div>

      <h3 style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} strokeWidth={2.5} /> Team Performance</h3>
      {team.length > 0 ? (
        <DataTable columns={teamColumns} rows={team} />
      ) : (
        <p className="empty-state">No team members to show yet.</p>
      )}
    </div>
  );
}
