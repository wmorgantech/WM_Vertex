import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, UserPlus, GraduationCap, BookOpen, Building2, FolderKanban, Plus } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import AreaChart from '@/components/shared/charts/AreaChart';
import PieChart from '@/components/shared/charts/PieChart';
import HorizontalBarChart from '@/components/shared/charts/HorizontalBarChart';
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

const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'JOT', UNCATEGORIZED: 'Uncategorized' };
const AUDIT_ACTION_LABELS = {
  FINAL_APPROVED: 'Internship approved', OFFER_LETTER_GENERATED: 'Offer letter generated',
  OFFER_LETTER_DOWNLOADED: 'Offer letter downloaded', CERTIFICATE_GENERATED: 'Certificate generated',
  CERTIFICATE_DOWNLOADED: 'Certificate downloaded', CATEGORY_SET: 'Category updated',
};

export default function SuperAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/overview')
      .then(({ data }) => setOverview(data.data))
      .finally(() => setLoading(false));
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

  const { headcount, tasks, attendance, projects, reports, audit } = overview;
  const taskChartData = tasks.byStatus.map((t) => ({ name: t.status.replace('_', ' '), count: t.count }));
  const attendanceTrendData = (attendance.dailyTrend || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    present: d.present,
  }));
  const categoryChartData = Object.entries(reports?.categoryBreakdown || {}).map(([key, count]) => ({
    status: CATEGORY_LABELS[key] || key,
    count,
  }));
  const auditActivity = (audit?.recent || []).map((a) => ({
    id: a.id,
    title: a.internName,
    subtitle: `${AUDIT_ACTION_LABELS[a.action] || a.action} by ${a.actorName}`,
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
        <KpiCard label="Departments" value={headcount.totalDepartments} icon={Building2} accent="muted" />
        <KpiCard label="Projects" value={projects.totalProjects} icon={FolderKanban} accent="info" />
        <KpiCard label="Active Users" value={headcount.activeUsers} icon={UserCheck} accent="success" />
      </div>

      {/* Three distinct chart forms, each suited to what it's actually
          showing: a trend over time (area), a status split of one whole
          (donut), and a short ranked list of named categories (horizontal
          bars) — deliberately not the same chart shape twice. */}
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
            <CardTitle>Internship Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {categoryChartData.length > 0 ? (
              <HorizontalBarChart data={categoryChartData} dataKey="count" nameKey="status" height={categoryChartData.length * 56 + 40} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No internship enrollments yet.</p>
            )}
          </CardContent>
        </Card>
        <AuditLogTimeline items={auditActivity} emptyMessage="No internship lifecycle activity yet." />
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
