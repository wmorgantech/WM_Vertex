import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, UserPlus, GraduationCap, BookOpen, FolderKanban, Plus, IndianRupee,
  CalendarOff, FileClock, FileText, FolderOpen, MessageSquare, Inbox, BellRing,
  Activity, MoreVertical, CalendarDays, ChevronDown, BarChart3, PieChart as PieIcon,
} from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import { Bar, BarChart, Cell, CartesianGrid, Label, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

// "Add X" shortcuts, each icon matching the identical icon already used by
// that module's own Add button (EmployeeList/Interns/Trainees all use
// UserPlus for their own "Add"; Projects/Departments use Plus) — clicking
// through lands on the real Add flow on that page, nothing fake here.
const QUICK_ACTIONS = [
  { to: '/employees', label: 'Add Employee', icon: UserPlus },
  { to: '/interns', label: 'Add Intern', icon: UserPlus },
  { to: '/trainees', label: 'Add Trainee', icon: UserPlus },
  { to: '/projects', label: 'Add Project', icon: Plus },
  { to: '/departments', label: 'Add Department', icon: Plus },
];

// Every row is a real, currently-pending count from an existing endpoint —
// nothing computed or invented for this panel. Leave/Enquiries have no
// dedicated count endpoint, so those two are fetched via the same
// status-filtered list + array length every other "how many are pending"
// card in this app already uses (see Employees/Interns/Tasks summary
// cards) rather than adding a new backend aggregate.
const NEEDS_ATTENTION_META = [
  { key: 'leave', label: 'Pending Leave Requests', to: '/leave', icon: CalendarOff },
  { key: 'timesheets', label: 'Pending Timesheets', to: '/timesheets', icon: FileClock },
  { key: 'workUpdates', label: 'Pending Work Updates', to: '/work-updates', icon: FileText },
  { key: 'documents', label: 'Pending Document Verifications', to: '/documents', icon: FolderOpen },
  { key: 'enquiries', label: 'New Enquiries', to: '/enquiries', icon: MessageSquare },
];

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [needsAttention, setNeedsAttention] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // allSettled — one failing call (e.g. a transient 429) shouldn't blank
    // the whole dashboard, matching the pattern already used across every
    // list page in this app.
    Promise.allSettled([
      api.get('/analytics/overview'),
      api.get('/leave', { params: { status: 'PENDING' } }),
      api.get('/enquiries', { params: { status: 'NEW' } }),
      api.get('/audit-logs', { params: { limit: 6 } }),
    ]).then(([ov, leave, enquiries, audit]) => {
      if (ov.status === 'fulfilled') {
        setOverview(ov.value.data.data);
        setNeedsAttention({
          leave: leave.status === 'fulfilled' ? leave.value.data.data.length : null,
          timesheets: ov.value.data.data.pendingApprovals?.timesheets ?? null,
          workUpdates: ov.value.data.data.pendingApprovals?.workUpdates ?? null,
          documents: ov.value.data.data.documents?.pendingVerifications ?? null,
          enquiries: enquiries.status === 'fulfilled' ? enquiries.value.data.data.length : null,
        });
      }
      if (audit.status === 'fulfilled') setRecentActivity(audit.value.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!overview) {
    return <p className="text-sm text-muted-foreground">No analytics available.</p>;
  }

  const { headcount, tasks, attendance, projects, finance } = overview;
  const taskChartData = tasks.byStatus.map((t) => ({ name: t.status.replace('_', ' '), count: t.count }));
  const attendanceTrendData = (attendance.dailyTrend || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    present: d.present,
  }));
  const attentionItems = NEEDS_ATTENTION_META.map((meta) => ({ ...meta, count: needsAttention?.[meta.key] })).filter((item) => item.count);
  const taskTotal = taskChartData.reduce((sum, item) => sum + item.count, 0);
  const taskColors = ['#6354e8', '#18b977', '#ffb52d', '#ef4b51', '#8d80ef'];
  const dateRange = `${new Date(Date.now() - 29 * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="super-dashboard">
      <header className="super-dashboard-header">
        <div><h1>Good Morning, {user?.firstName || 'there'}! <span aria-hidden="true">👋</span></h1><p>Here's what's happening across your organization today.</p></div>
        <button type="button" className="dashboard-date-button"><CalendarDays size={17} />{dateRange}<ChevronDown size={16} /></button>
      </header>

      <section className="dashboard-kpi-grid">
        <DashboardKpi label="Employees" value={headcount.totalEmployees} icon={Users} tone="purple" hint="Total employees" />
        <DashboardKpi label="Interns" value={headcount.totalInterns} icon={GraduationCap} tone="blue" hint="Active interns" />
        <DashboardKpi label="Trainees" value={headcount.totalTrainees} icon={BookOpen} tone="pink" hint="Total trainees" />
        <DashboardKpi label="Projects" value={projects.totalProjects} icon={FolderKanban} tone="green" hint="All projects" />
        <DashboardKpi label="Active Users" value={headcount.activeUsers} icon={UserCheck} tone="orange" hint="Current active users" />
        <DashboardKpi label="Total Expenses" value={`₹${(finance?.totalExpenses ?? 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="red" hint="All recorded expenses" />
      </section>

      <section className="dashboard-chart-grid">
        <DashboardPanel title="Attendance — Last 30 Days" icon={BarChart3} action="Last 30 Days" className="dashboard-attendance-panel">
          {attendanceTrendData.length ? <div className="dashboard-attendance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={attendanceTrendData} margin={{ top: 12, right: 10, left: -16, bottom: 5 }}><CartesianGrid vertical={false} stroke="#e8ebf4" /><XAxis dataKey="date" tick={{ fill: '#7280a0', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(attendanceTrendData.length / 10) - 1)} /><YAxis allowDecimals={false} tick={{ fill: '#7280a0', fontSize: 10 }} axisLine={false} tickLine={false} width={30} /><Tooltip contentStyle={{ border: '1px solid #e7e9f2', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="present" fill="#7566eb" radius={[5, 5, 0, 0]} maxBarSize={14} /></BarChart></ResponsiveContainer></div> : <DashboardEmpty text="No attendance recorded yet." />}
        </DashboardPanel>
        <DashboardPanel title="Tasks by Status" icon={PieIcon} action="This Month" className="dashboard-task-panel">
          {taskChartData.length ? <><div className="dashboard-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={taskChartData} dataKey="count" nameKey="name" innerRadius={54} outerRadius={82} stroke="none" paddingAngle={1}><Label content={() => <g><text x="50%" y="47%" textAnchor="middle" fill="#111a47" fontSize="23" fontWeight="700">{taskTotal}</text><text x="50%" y="62%" textAnchor="middle" fill="#7883a2" fontSize="11">Total Tasks</text></g>} />{taskChartData.map((entry, index) => <Cell key={entry.name} fill={taskColors[index % taskColors.length]} />)}</Pie></PieChart></ResponsiveContainer></div><div className="dashboard-task-legend">{taskChartData.map((entry, index) => <div key={entry.name}><span><i style={{ background: taskColors[index % taskColors.length] }} />{entry.name}</span><strong>{entry.count}</strong><em>{taskTotal ? Math.round((entry.count / taskTotal) * 100) : 0}%</em></div>)}</div></> : <DashboardEmpty text="No task status data yet." />}
        </DashboardPanel>
      </section>

      <section className="dashboard-bottom-grid">
        <div className="dashboard-panel dashboard-attention-panel"><DashboardPanelHeading title="Needs Attention" icon={BellRing} action="View All" /><div className="dashboard-attention-list">{attentionItems.length ? attentionItems.map((item) => <Link key={item.key} to={item.to} className="dashboard-attention-row"><span className="dashboard-row-icon"><item.icon size={17} /></span><span><strong>{item.label}</strong><small>{item.count} {item.count === 1 ? 'item' : 'items'} waiting for review</small></span><b>{item.count}</b></Link>) : <DashboardEmpty text="Nothing pending — you're all caught up." />}</div></div>
        <div className="dashboard-panel dashboard-activity-panel"><DashboardPanelHeading title="Recent Activity" icon={Activity} action="View All" to="/configuration/audit-log" /><div className="dashboard-activity-list">{recentActivity.length ? recentActivity.map((item) => { const actor = item.actor; const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'System'; return <div className="dashboard-activity-row" key={item.id}><span className="dashboard-activity-avatar">{actor ? `${actor.firstName?.[0] || ''}${actor.lastName?.[0] || ''}`.toUpperCase() : 'SY'}</span><span><strong>{actorName} <small>{item.action.replace(/_/g, ' ').toLowerCase()}</small> {item.entityLabel || item.module.replace(/_/g, ' ')}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span><button type="button" aria-label="Activity options"><MoreVertical size={16} /></button></div>; }) : <DashboardEmpty text="No recent activity yet." />}</div></div>
      </section>

      <section className="dashboard-panel dashboard-quick-actions"><DashboardPanelHeading title="Quick Actions" icon={FolderKanban} /><div className="dashboard-quick-action-grid">{QUICK_ACTIONS.map((action) => <Link key={action.to} to={action.to} className="dashboard-quick-action"><action.icon size={18} /><span>{action.label}</span></Link>)}</div></section>
    </div>
  );
}

function DashboardKpi({ label, value, icon: Icon, tone, hint }) {
  return <article className="dashboard-kpi"><span className={`dashboard-kpi-icon dashboard-kpi-icon-${tone}`}><Icon size={22} /></span><span className="dashboard-kpi-copy"><strong>{label}</strong><b>{value}</b><small>{hint}</small></span><MoreVertical className="dashboard-kpi-more" size={17} /></article>;
}

function DashboardPanel({ title, icon: Icon, action, className = '', children }) {
  return <article className={`dashboard-panel ${className}`}><DashboardPanelHeading title={title} icon={Icon} action={action} /><div className="dashboard-panel-content">{children}</div></article>;
}

function DashboardPanelHeading({ title, icon: Icon, action, to }) {
  const content = <><span className="dashboard-panel-icon"><Icon size={19} /></span><h2>{title}</h2></>;
  return <header className="dashboard-panel-heading"><div>{content}</div>{to ? <Link to={to} className="dashboard-view-all">{action}</Link> : action && <button type="button" className="dashboard-panel-action">{action}<ChevronDown size={15} /></button>}</header>;
}

function DashboardEmpty({ text }) { return <div className="dashboard-empty"><Inbox size={20} /><span>{text}</span></div>; }
