import { useEffect, useState } from 'react';
import { Users, GraduationCap, UserCheck, Building2, FolderKanban, ClipboardCheck, FileText, Award, History, FolderOpen, UserX, Settings, Presentation, FileSignature, IndianRupee } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import ActivityList from '@/components/shared/ActivityList';
import QuickActions from '@/components/shared/QuickActions';
import InsightsPanel from '@/components/shared/InsightsPanel';
import BarChart from '@/components/shared/charts/BarChart';
import PieChart from '@/components/shared/charts/PieChart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { superAdminInsights } from '@/lib/dashboardInsights';

const QUICK_ACTIONS = [
  { to: '/employees', label: 'Manage Employees', icon: Users },
  { to: '/documents', label: 'Review Internships', icon: FolderOpen },
  { to: '/departments', label: 'Manage Departments', icon: Building2 },
  { to: '/projects', label: 'View Projects', icon: FolderKanban },
  { to: '/analytics', label: 'Open Analytics', icon: ClipboardCheck },
  { to: '/expenses', label: 'View Expenses', icon: IndianRupee },
  { to: '/configuration/permissions', label: 'Configure Permissions', icon: Settings },
];

const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'JOT', UNCATEGORIZED: 'Uncategorized' };
const AUDIT_ACTION_LABELS = {
  FINAL_APPROVED: 'Internship approved', OFFER_LETTER_GENERATED: 'Offer letter generated',
  OFFER_LETTER_DOWNLOADED: 'Offer letter downloaded', CERTIFICATE_GENERATED: 'Certificate generated',
  CERTIFICATE_DOWNLOADED: 'Certificate downloaded', CATEGORY_SET: 'Category updated',
};

export default function SuperAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/timesheets', { params: { status: 'PENDING' } }),
      api.get('/work-updates', { params: { status: 'SUBMITTED' } }),
    ])
      .then(([ov, ts, wu]) => {
        setOverview(ov.data.data);
        const timesheetItems = ts.data.data.slice(0, 5).map((t) => ({
          id: `ts-${t.id}`,
          title: `${t.user.firstName} ${t.user.lastName}`,
          subtitle: `${t.project?.name || 'No project'} · ${t.hoursLogged}h`,
          meta: new Date(t.date).toLocaleDateString(),
          badgeValue: t.status,
        }));
        const workUpdateItems = wu.data.data.slice(0, 5).map((w) => ({
          id: `wu-${w.id}`,
          title: `${w.user.firstName} ${w.user.lastName}`,
          subtitle: w.summary,
          meta: new Date(w.date).toLocaleDateString(),
          badgeValue: w.status,
        }));
        setActivity([...timesheetItems, ...workUpdateItems].slice(0, 6));
      })
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

  const { headcount, projects, tasks, attendance, pendingApprovals, documents, reports, offerLetters, certificates, audit, businessDevelopment, finance } = overview;
  const taskChartData = tasks.byStatus.map((t) => ({ name: t.status.replace('_', ' '), count: t.count }));
  const attendanceChartData = Object.entries(attendance.last30Days).map(([status, count]) => ({
    status: status.replace('_', ' '),
    count,
  }));
  const categoryChartData = Object.entries(reports?.categoryBreakdown || {}).map(([key, count]) => ({
    status: CATEGORY_LABELS[key] || key,
    count,
  }));
  const auditActivity = (audit?.recent || []).map((a) => ({
    id: a.id,
    title: a.internName,
    subtitle: `${AUDIT_ACTION_LABELS[a.action] || a.action} by ${a.actorName}`,
    meta: new Date(a.createdAt).toLocaleDateString(),
    badgeValue: a.action,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Organization Overview" subtitle="Real-time snapshot across the entire organization" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Employees" value={headcount.totalEmployees} icon={Users} accent="primary" />
        <KpiCard label="Interns" value={headcount.totalInterns} icon={GraduationCap} accent="purple" />
        <KpiCard label="Trainees" value={headcount.totalTrainees} icon={GraduationCap} accent="purple" />
        <KpiCard label="Active Users" value={headcount.activeUsers} icon={UserCheck} accent="success" />
        <KpiCard label="Departments" value={headcount.totalDepartments} icon={Building2} accent="info" />
        <KpiCard
          label="Active Projects"
          value={projects.activeProjects}
          hint={`${projects.totalProjects} total`}
          icon={FolderKanban}
          accent="primary"
        />
        <KpiCard
          label="Pending Approvals"
          value={pendingApprovals.timesheets + pendingApprovals.workUpdates}
          hint={`${pendingApprovals.timesheets} timesheets · ${pendingApprovals.workUpdates} updates`}
          icon={ClipboardCheck}
          accent="warning"
        />
        <KpiCard label="Pending Internship Approvals" value={documents.pendingApplications} icon={ClipboardCheck} accent="warning" />
        <KpiCard label="Tasks Not Allocated" value={tasks.unallocated} icon={UserX} accent="destructive" />
        {offerLetters && (
          <KpiCard label="Offer Letters" value={offerLetters.generated} hint={`${offerLetters.pending} pending`} icon={FileText} accent="info" />
        )}
        {certificates && (
          <KpiCard label="Certificates" value={certificates.generated} hint={`${certificates.eligiblePending} ready to issue`} icon={Award} accent="success" />
        )}
        <KpiCard label="Upcoming Workshops" value={businessDevelopment.upcomingWorkshops} icon={Presentation} accent="info" />
        <KpiCard label="Workshop Follow-ups" value={businessDevelopment.workshopFollowUpsOverdue} icon={ClipboardCheck} accent={businessDevelopment.workshopFollowUpsOverdue > 0 ? 'destructive' : 'success'} />
        <KpiCard label="Active MOUs" value={businessDevelopment.activeMous} icon={FileSignature} accent="primary" />
        <KpiCard label="MOUs Expiring Soon" value={businessDevelopment.mousExpiringSoon} icon={FileSignature} accent={businessDevelopment.mousExpiringSoon > 0 ? 'warning' : 'success'} />
        {finance && (
          <KpiCard label="Total Expenses" value={`₹${finance.totalExpenses.toLocaleString()}`} hint={`₹${finance.last30DaysExpenses.toLocaleString()} last 30 days`} icon={IndianRupee} accent="warning" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <BarChart data={taskChartData} dataKey="count" nameKey="name" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <PieChart data={attendanceChartData} dataKey="count" nameKey="status" />
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
              <PieChart data={categoryChartData} dataKey="count" nameKey="status" />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No internship enrollments yet.</p>
            )}
          </CardContent>
        </Card>
        <ActivityList
          title="Recent Audit Log"
          items={auditActivity}
          emptyMessage="No internship lifecycle activity yet."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityList
            title="Needs Attention"
            items={activity}
            emptyMessage="No pending approvals right now."
            viewAllTo="/timesheets"
          />
        </div>
        <div className="space-y-4">
          <QuickActions actions={QUICK_ACTIONS} />
          <InsightsPanel insights={superAdminInsights(overview)} />
        </div>
      </div>
    </div>
  );
}
