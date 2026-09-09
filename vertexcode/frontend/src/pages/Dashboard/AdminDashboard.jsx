import { useEffect, useState } from 'react';
import { FileClock, FileText, FolderKanban, Users, ListTodo, FolderOpen } from 'lucide-react';
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
  // No "View Expenses" quick action — Expenses is Super Admin-only (see
  // backend/src/routes/expense.routes.js). Analytics Overview also withholds
  // the finance block entirely for non-Super-Admins now, so there's no
  // expense KPI on this dashboard either — see analytics.controller.js.
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

  const { headcount, tasks, pendingApprovals, documents } = overview;
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

      {/* Trimmed to org-wide "needs my attention" metrics that aren't one
          click away with more detail elsewhere: Active Projects lives on
          the Projects page; Pending Verifications/Verified Interns/Rejected
          Documents/Pending Applications are the same numbers the Intern
          Document Review page's own KPI row already shows (as Pending
          Review/Verified/Rejected/Pending Final Approval); Tasks In
          Progress/Blocked/Not Allocated now live on the Tasks page; Upcoming
          Workshops/Workshop Follow-ups moved to the Workshops page; Active
          MOUs/MOUs Expiring Soon moved to the MOUs page. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Pending Timesheets" value={pendingApprovals.timesheets} icon={FileClock} accent="warning" />
        <KpiCard label="Pending Work Updates" value={pendingApprovals.workUpdates} icon={FileText} accent="warning" />
        <KpiCard
          label="Team Size"
          value={headcount.totalEmployees + headcount.totalInterns}
          hint={`${headcount.totalInterns} interns`}
          icon={Users}
          accent="purple"
        />
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
