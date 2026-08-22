import { useEffect, useState } from 'react';
import { FileClock, FileText, FolderKanban, ListChecks, AlertTriangle, Users, ListTodo, ShieldCheck, ShieldAlert, FolderOpen, ClipboardCheck } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import ActivityList from '@/components/shared/ActivityList';
import QuickActions from '@/components/shared/QuickActions';
import InsightsPanel from '@/components/shared/InsightsPanel';
import BarChart from '@/components/shared/charts/BarChart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { adminInsights } from '@/lib/dashboardInsights';

const QUICK_ACTIONS = [
  { to: '/timesheets', label: 'Review Timesheets', icon: FileClock },
  { to: '/work-updates', label: 'Review Work Updates', icon: FileText },
  { to: '/documents', label: 'Review Documents', icon: FolderOpen },
  { to: '/tasks', label: 'Assign a Task', icon: ListTodo },
  { to: '/projects', label: 'View Projects', icon: FolderKanban },
  { to: '/employees', label: 'View Employees', icon: Users },
];

function initials(user) {
  return `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [team, setTeam] = useState([]);
  const [pendingTimesheets, setPendingTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/team'),
      api.get('/timesheets', { params: { status: 'PENDING' } }),
    ])
      .then(([ov, tm, ts]) => {
        setOverview(ov.data.data);
        setTeam(tm.data.data);
        setPendingTimesheets(ts.data.data);
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

  const { headcount, projects, tasks, pendingApprovals, documents } = overview;
  const inProgress = tasks.byStatus.find((t) => t.status === 'IN_PROGRESS')?.count || 0;
  const blocked = tasks.byStatus.find((t) => t.status === 'BLOCKED')?.count || 0;
  const taskChartData = tasks.byStatus.map((t) => ({ name: t.status.replace('_', ' '), count: t.count }));

  const leaderboard = [...team].sort((a, b) => (b.taskCompletionRate ?? 0) - (a.taskCompletionRate ?? 0)).slice(0, 5);

  const timesheetActivity = pendingTimesheets.slice(0, 6).map((t) => ({
    id: t.id,
    title: `${t.user.firstName} ${t.user.lastName}`,
    subtitle: `${t.project?.name || 'No project'} · ${t.hoursLogged}h`,
    meta: new Date(t.date).toLocaleDateString(),
    badgeValue: t.status,
  }));

  const DOC_TYPE_LABELS = { BONAFIDE: 'Bonafide Certificate', COLLEGE_ID: 'College ID Card', RESUME: 'Resume', ADDITIONAL: 'Additional Document' };
  const documentActivity = documents.recentSubmissions.map((d) => ({
    id: d.id,
    title: d.internName,
    subtitle: DOC_TYPE_LABELS[d.type] || d.type,
    meta: new Date(d.updatedAt).toLocaleDateString(),
    badgeValue: d.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Team Operations" subtitle="Your team's day-to-day, at a glance" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Pending Timesheets" value={pendingApprovals.timesheets} icon={FileClock} accent="warning" />
        <KpiCard label="Pending Work Updates" value={pendingApprovals.workUpdates} icon={FileText} accent="warning" />
        <KpiCard label="Active Projects" value={projects.activeProjects} icon={FolderKanban} accent="primary" />
        <KpiCard label="Tasks In Progress" value={inProgress} icon={ListChecks} accent="info" />
        <KpiCard label="Tasks Blocked" value={blocked} icon={AlertTriangle} accent="destructive" />
        <KpiCard
          label="Team Size"
          value={headcount.totalEmployees + headcount.totalInterns}
          hint={`${headcount.totalInterns} interns`}
          icon={Users}
          accent="purple"
        />
        <KpiCard label="Pending Verifications" value={documents.pendingVerifications} icon={FolderOpen} accent="warning" />
        <KpiCard label="Pending Applications" value={documents.pendingApplications} icon={ClipboardCheck} accent="warning" />
        <KpiCard label="Verified Interns" value={documents.verifiedInterns} icon={ShieldCheck} accent="success" />
        <KpiCard label="Rejected Documents" value={documents.rejectedDocuments} icon={ShieldAlert} accent="destructive" />
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
            <CardTitle>Team Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            {leaderboard.length === 0 && <p className="text-sm text-muted-foreground">No team activity yet.</p>}
            {leaderboard.map((member) => (
              <div key={member.user.id} className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarFallback>{initials(member.user)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">{member.taskCompletionRate ?? 0}%</span>
                  </div>
                  <Progress value={member.taskCompletionRate ?? 0} className="mt-1.5 h-1.5" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ActivityList
            title="Pending Timesheet Reviews"
            items={timesheetActivity}
            emptyMessage="No timesheets waiting on you."
            viewAllTo="/timesheets"
          />
          <ActivityList
            title="Recently Submitted Documents"
            items={documentActivity}
            emptyMessage="No documents submitted recently."
            viewAllTo="/documents"
          />
        </div>
        <div className="space-y-4">
          <QuickActions actions={QUICK_ACTIONS} />
          <InsightsPanel insights={adminInsights(overview, team)} />
        </div>
      </div>
    </div>
  );
}
