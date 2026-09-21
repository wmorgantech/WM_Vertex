import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, Clock3, FolderKanban, ListChecks, MoreVertical, Star, Users, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import { Bar, BarChart, Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const STATUS_COLORS = ['#6558e8', '#16b86a', '#f6bd32', '#f0444d', '#a78bfa', '#5bb7d8'];

function AnalyticsCardIcon({ children, tone = 'purple' }) {
  return <span className={`analytics-card-icon analytics-card-icon-${tone}`}>{children}</span>;
}

function MetricCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <article className="analytics-metric-card">
      <div className="analytics-metric-main">
        <AnalyticsCardIcon tone={tone}><Icon size={23} strokeWidth={2.2} /></AnalyticsCardIcon>
        <div className="analytics-metric-copy">
          <span className="analytics-metric-label">{label}</span>
          <strong className="analytics-metric-value">{value}</strong>
          <span className="analytics-metric-hint">{hint}</span>
        </div>
      </div>
      <button className="analytics-more" type="button" aria-label={`${label} options`}><MoreVertical size={18} /></button>
    </article>
  );
}

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
  const totalInterns = Object.values(interns.byStatus).reduce((total, count) => total + count, 0);
  const internStatusData = Object.entries(interns.byStatus).map(([status, count]) => ({
    status: status.replace(/_/g, ' '),
    count,
    percentage: totalInterns ? Math.round((count / totalInterns) * 100) : 0,
  }));
  const pendingApprovals = overview.pendingApprovals.timesheets + overview.pendingApprovals.workUpdates;

  return (
    <div className="analytics-page">
      <header className="analytics-page-header">
        <div>
          <h1>Productivity Analytics</h1>
          <p>Team performance, completion metrics and utilization trends</p>
        </div>
        <button type="button" className="analytics-date-button"><CalendarDays size={17} /><span>Aug 21, 2025 - Sep 18, 2025</span><ChevronDown size={17} /></button>
      </header>

      <section className="analytics-metric-grid" aria-label="Analytics summary">
        <MetricCard label="ACTIVE PROJECTS" value={overview.projects.activeProjects} hint="Current active projects" tone="purple" icon={FolderKanban} />
        <MetricCard label="TOTAL TASKS" value={overview.tasks.total} hint="Across all projects" tone="blue" icon={ListChecks} />
        <MetricCard label="AVG. INTERN RATING" value={interns.averagePerformanceRating ?? '—'} hint={interns.averagePerformanceRating == null ? 'No data available' : 'Across rated interns'} tone="orange" icon={Star} />
        <MetricCard label="PENDING APPROVALS" value={pendingApprovals} hint="Timesheets + Work Updates awaiting review" tone="red" icon={Clock3} />
      </section>

      <section className="analytics-chart-grid">
        <article className="analytics-chart-card analytics-status-card">
          <div className="analytics-chart-header">
            <div className="analytics-chart-title"><AnalyticsCardIcon><BarChart3 size={20} /></AnalyticsCardIcon><h2>Intern Program Status</h2></div>
            <button type="button" className="analytics-period-button">This Month<ChevronDown size={15} /></button>
          </div>
          {internStatusData.length > 0 ? (
            <div className="analytics-bar-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={internStatusData} margin={{ top: 28, right: 16, left: 2, bottom: 8 }}>
                  <XAxis dataKey="status" tick={{ fill: '#64708f', fontSize: 10 }} axisLine={{ stroke: '#dfe5ef' }} tickLine={false} interval={0} tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 11)}...` : value} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64708f', fontSize: 10 }} axisLine={{ stroke: '#dfe5ef' }} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: '#f6f6ff' }} contentStyle={{ border: '1px solid #e7e8f2', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[7, 7, 0, 0]} maxBarSize={46}>
                    {internStatusData.map((entry, index) => <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="analytics-empty">No intern enrollments yet.</p>}
        </article>

        <article className="analytics-chart-card analytics-distribution-card">
          <div className="analytics-chart-header">
            <div className="analytics-chart-title"><AnalyticsCardIcon><PieChartIcon size={20} /></AnalyticsCardIcon><h2>Status Distribution</h2></div>
            <button type="button" className="analytics-period-button">This Month<ChevronDown size={15} /></button>
          </div>
          {internStatusData.length > 0 ? (
            <>
              <div className="analytics-donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={internStatusData} dataKey="count" nameKey="status" innerRadius={60} outerRadius={86} paddingAngle={0} stroke="none">
                      {internStatusData.map((entry, index) => <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                      <Label content={() => <g><text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fill="#111a47" fontSize="24" fontWeight="700">{totalInterns}</text><text x="50%" y="63%" textAnchor="middle" fill="#7883a2" fontSize="11">Total Interns</text></g>} position="center" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="analytics-legend">
                {internStatusData.map((entry, index) => <div className="analytics-legend-row" key={entry.status}><span className="analytics-legend-name"><i style={{ background: STATUS_COLORS[index % STATUS_COLORS.length] }} />{entry.status}</span><strong>{entry.count}</strong><span>{entry.percentage}%</span></div>)}
              </div>
            </>
          ) : <p className="analytics-empty">No intern enrollments yet.</p>}
        </article>
      </section>

      <h3 style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} strokeWidth={2.5} /> Team Performance</h3>
      {team.length > 0 ? (
        <DataTable columns={teamColumns} rows={team} />
      ) : (
        <p className="empty-state">No team members to show yet.</p>
      )}
    </div>
  );
}
