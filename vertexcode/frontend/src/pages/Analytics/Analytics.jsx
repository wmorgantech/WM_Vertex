import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatCard from '../../components/common/StatCard';
import SimpleBarChart from '../../components/charts/SimpleBarChart';
import SimplePieChart from '../../components/charts/SimplePieChart';

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [team, setTeam] = useState([]);
  const [interns, setInterns] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/analytics/overview'), api.get('/analytics/team'), api.get('/analytics/interns')])
      .then(([o, t, i]) => { setOverview(o.data.data); setTeam(t.data.data); setInterns(i.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading analytics...</div>;

  const teamColumns = [
    { key: 'user', header: 'Name', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'role', header: 'Role', render: (r) => r.user.role },
    { key: 'taskCompletionRate', header: 'Task Completion', render: (r) => `${r.taskCompletionRate}%` },
    { key: 'attendanceDaysLast30', header: 'Attendance (30d)', render: (r) => r.attendanceDaysLast30 },
    { key: 'hoursLoggedLast30', header: 'Hours Logged (30d)', render: (r) => r.hoursLoggedLast30 },
  ];

  const taskChartData = overview.tasks.byStatus.map((t) => ({ name: t.status.replace('_', ' '), count: t.count }));
  const internStatusData = Object.entries(interns.byStatus).map(([status, count]) => ({ status: status.replace(/_/g, ' '), count }));

  return (
    <div>
      <PageHeader title="Productivity Analytics" subtitle="Team performance, completion metrics and utilization trends" />

      <div className="stat-grid">
        <StatCard label="Active Projects" value={overview.projects.activeProjects} accent="blue" />
        <StatCard label="Total Tasks" value={overview.tasks.total} accent="gray" />
        <StatCard label="Avg. Intern Rating" value={interns.averagePerformanceRating ?? '—'} accent="purple" />
        <StatCard label="Pending Approvals" value={overview.pendingApprovals.timesheets + overview.pendingApprovals.workUpdates} accent="amber" />
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>Task Distribution</h3>
          <SimpleBarChart data={taskChartData} dataKey="count" nameKey="name" />
        </div>
        <div className="card">
          <h3>Intern Program Status</h3>
          <SimplePieChart data={internStatusData} dataKey="count" nameKey="status" />
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>Team Performance</h3>
      <DataTable columns={teamColumns} rows={team} />
    </div>
  );
}
