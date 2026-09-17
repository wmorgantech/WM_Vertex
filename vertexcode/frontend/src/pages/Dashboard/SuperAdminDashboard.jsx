import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, UserPlus, GraduationCap, BookOpen, FolderKanban, Plus, IndianRupee,
  CalendarOff, FileClock, FileText, FolderOpen, MessageSquare, ChevronRight, Inbox,
} from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import AreaChart from '@/components/shared/charts/AreaChart';
import PieChart from '@/components/shared/charts/PieChart';
import AuditLogTimeline from './AuditLogTimeline';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  const activityItems = recentActivity.map((a) => ({
    id: a.id,
    title: a.entityLabel || a.module.replace(/_/g, ' '),
    subtitle: `${a.action.replace(/_/g, ' ')} by ${a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : 'System'}`,
    meta: `${new Date(a.createdAt).toLocaleDateString()} · ${new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    badgeValue: a.action,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Organization Overview" subtitle="Real-time snapshot across the entire organization" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Employees" value={headcount.totalEmployees} icon={Users} accent="primary" />
        <KpiCard label="Interns" value={headcount.totalInterns} icon={GraduationCap} accent="info" />
        <KpiCard label="Trainees" value={headcount.totalTrainees} icon={BookOpen} accent="purple" />
        <KpiCard label="Projects" value={projects.totalProjects} icon={FolderKanban} accent="info" />
        <KpiCard label="Active Users" value={headcount.activeUsers} icon={UserCheck} accent="success" />
        <KpiCard label="Total Expenses" value={`₹${(finance?.totalExpenses ?? 0).toLocaleString('en-IN')}`} icon={IndianRupee} accent="warning" />
      </div>

      {/* Two forms suited to what each is actually showing: a trend over
          time (area) and a status split of one whole (donut) — the
          Internship Category Breakdown chart previously here duplicated
          nothing shown elsewhere but was a narrow operational detail, not
          an executive-level metric; replaced below with an actionable
          "Needs Attention" panel and a genuinely org-wide Recent Activity
          feed (previously scoped to internship-lifecycle events only). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {attendanceTrendData.length > 0 ? (
              <AreaChart data={attendanceTrendData} dataKey="present" nameKey="date" />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No attendance recorded yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <PieChart data={taskChartData} dataKey="count" nameKey="name" height={240} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pb-5">
            {needsAttention && NEEDS_ATTENTION_META.every((m) => !needsAttention[m.key]) ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="size-5 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>
              </div>
            ) : (
              NEEDS_ATTENTION_META.map((m) => {
                const count = needsAttention?.[m.key];
                if (!count) return null;
                return (
                  <Link
                    key={m.key}
                    to={m.to}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                      <m.icon className="size-4" />
                    </span>
                    <span className="flex-1 font-medium text-foreground">{m.label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{count}</span>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
        <AuditLogTimeline items={activityItems} emptyMessage="No recent activity yet." viewAllTo="/configuration/audit-log" />
      </div>

      {/* Compact action cards, not the shared list-style QuickActions —
          each its own bordered tile with an icon chip, arranged in a
          responsive grid rather than a stacked list of rows. */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <action.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
