import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AlertCircle, TrendingUp, FileClock, NotebookPen, ListChecks,
  FolderOpen, CalendarCheck, CalendarOff, MessageSquare, RotateCcw,
} from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import ActivityList from '@/components/shared/ActivityList';
import QuickActions from '@/components/shared/QuickActions';
import InsightsPanel from '@/components/shared/InsightsPanel';
import TimesheetStatusCard from '@/components/shared/TimesheetStatusCard';
import Table from '@/components/shared/Table';
import Badge from '@/components/shared/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useClockWidget } from '@/pages/Dashboard/EmployeeDashboard';
import { internInsights } from '@/lib/dashboardInsights';
import { localDateString } from '@/lib/utils';

const REQUIRED_DOC_TYPES = ['BONAFIDE'];
const DOC_TYPE_LABELS = { BONAFIDE: 'Bonafide Certificate' };

const QUICK_ACTIONS = [
  { to: '/leave', label: 'Apply Leave', icon: CalendarOff },
  { to: '/work-updates', label: 'Add Work Update', icon: NotebookPen },
  { to: '/tasks', label: 'View Tasks', icon: ListChecks },
  { to: '/enquiries', label: 'My Enquiries', icon: MessageSquare },
  { to: '/timesheets', label: 'Timesheet', icon: FileClock },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

function TodaysOverviewCard({ tasks, workUpdates }) {
  const { attendanceToday, clocking, handleClock } = useClockWidget();
  const today = localDateString();
  const tasksDueToday = tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === today);
  const workUpdateToday = workUpdates.find((w) => w.date.slice(0, 10) === today);

  const attendanceLabel = attendanceToday?.clockIn
    ? (attendanceToday?.clockOut ? 'Completed' : 'Clocked In')
    : 'Not clocked in';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pb-5 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarCheck className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Attendance</p>
            <p className="truncate text-sm font-semibold text-foreground">{attendanceLabel}</p>
          </div>
          {!attendanceToday?.clockIn && (
            <Button size="sm" disabled={clocking} onClick={() => handleClock('clock-in')}>Clock In</Button>
          )}
          {attendanceToday?.clockIn && !attendanceToday?.clockOut && (
            <Button size="sm" variant="secondary" disabled={clocking} onClick={() => handleClock('clock-out')}>Clock Out</Button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/15 text-info">
            <ListChecks className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Tasks Due Today</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {tasksDueToday.length > 0 ? `${tasksDueToday.length} task${tasksDueToday.length === 1 ? '' : 's'}` : 'None due today'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple/15 text-purple">
            <NotebookPen className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Work Update</p>
            <p className="truncate text-sm font-semibold text-foreground">{workUpdateToday ? 'Submitted' : 'Not submitted'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InternDashboard() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [docs, setDocs] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [workUpdates, setWorkUpdates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      api.get('/analytics/me'),
      api.get('/tasks').catch(() => null),
      api.get('/interns/enrollments').catch(() => null),
      api.get('/documents/mine').catch(() => null),
      api.get('/leave', { params: { userId: user.id } }).catch(() => null),
      api.get('/work-updates', { params: { userId: user.id } }).catch(() => null),
      api.get('/notifications', { params: { limit: 5 } }).catch(() => null),
    ])
      .then(([perf, t, enr, docsRes, leaveRes, wuRes, notifRes]) => {
        setMe(perf.data.data);
        setTasks(t?.data.data || []);
        const mine = enr?.data.data.find((e) => e.user.id === user.id);
        setEnrollment(mine || null);
        setDocs(docsRes?.data.data || null);
        setLeaveRequests(leaveRes?.data.data || []);
        setWorkUpdates(wuRes?.data.data || []);
        setNotifications(notifRes?.data.data || []);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (loadError || !me) {
    return (
      <div className="space-y-6">
        <PageHeader title={`${getGreeting()}, ${user.firstName}`} subtitle="Here's an overview of your internship progress." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">We couldn't load your dashboard right now.</p>
            <Button size="sm" variant="secondary" onClick={load}>
              <RotateCcw /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const records = me.attendance?.last30Days || [];
  const presentDays = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const attendanceRate = records.length > 0 ? Math.round((presentDays / records.length) * 100) : null;
  const pendingTasksCount = Math.max((me.tasks?.total || 0) - (me.tasks?.done || 0), 0);

  const pendingLeaveCount = leaveRequests.filter((r) => r.status === 'PENDING').length;
  const latestLeave = [...leaveRequests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const leaveHint = latestLeave
    ? `Last: ${latestLeave.leaveType?.label || latestLeave.leaveTypeCode} — ${String(latestLeave.status).replace(/_/g, ' ')}`
    : 'No leave requests yet';

  const recentTasks = [...tasks]
    .sort((a, b) => {
      if ((a.status === 'DONE') !== (b.status === 'DONE')) return a.status === 'DONE' ? 1 : -1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 6);

  const myTasksColumns = [
    { key: 'title', header: 'Task', render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    { key: 'priority', header: 'Priority', render: (r) => <Badge value={r.priority} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'dueDate', header: 'Due Date', render: (r) => {
        const overdue = r.dueDate && r.status !== 'DONE' && new Date(r.dueDate) < new Date();
        return <span className={overdue ? 'font-medium text-destructive' : ''}>{formatDate(r.dueDate)}</span>;
      },
    },
    { key: 'assignedBy', header: 'Assigned By', render: (r) => (r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : '—') },
  ];

  const workUpdateItems = [...workUpdates]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .map((w) => ({
      id: w.id,
      title: new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      subtitle: w.summary,
      badgeValue: w.status,
    }));

  const notificationItems = notifications.slice(0, 5).map((n) => ({
    id: n.id,
    title: n.title,
    subtitle: n.message || undefined,
    meta: new Date(n.createdAt).toLocaleDateString(),
  }));

  const mentorName = enrollment?.mentor ? `${enrollment.mentor.firstName} ${enrollment.mentor.lastName}` : 'Not assigned';

  const missingDocs = docs
    ? REQUIRED_DOC_TYPES.filter((t) => {
        const doc = docs.documents.find((d) => d.type === t);
        return !doc || doc.status === 'REJECTED';
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${user.firstName}`}
        subtitle="Here's an overview of your internship progress."
        actions={<span className="text-sm font-medium text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>}
      />

      <TimesheetStatusCard />
      <TodaysOverviewCard tasks={tasks} workUpdates={workUpdates} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Internship Progress"
          value={enrollment ? `${enrollment.progressPercent}%` : '—'}
          hint={enrollment ? undefined : 'Not enrolled yet'}
          icon={TrendingUp}
          accent="info"
        />
        <KpiCard
          label="Attendance (30d)"
          value={attendanceRate != null ? `${attendanceRate}%` : '—'}
          hint={records.length > 0 ? `${presentDays}/${records.length} days present` : 'No records yet'}
          icon={CalendarCheck}
          accent={attendanceRate == null ? 'muted' : attendanceRate >= 80 ? 'success' : 'warning'}
        />
        <KpiCard
          label="Pending Tasks"
          value={pendingTasksCount}
          hint={me.tasks?.overdue > 0 ? `${me.tasks.overdue} overdue` : 'None overdue'}
          icon={ListChecks}
          accent={me.tasks?.overdue > 0 ? 'destructive' : pendingTasksCount > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Leave Status"
          value={pendingLeaveCount > 0 ? `${pendingLeaveCount} Pending` : 'No Pending'}
          hint={leaveHint}
          icon={CalendarOff}
          accent={pendingLeaveCount > 0 ? 'warning' : 'muted'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Internship Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            {enrollment ? (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{enrollment.batch?.name || 'Internship Program'}</span>
                    <span className="text-muted-foreground">{enrollment.progressPercent}%</span>
                  </div>
                  <Progress value={enrollment.progressPercent} />
                </div>
                <div className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Mentor</p>
                    <p className="font-medium text-foreground">{mentorName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge value={enrollment.completionStatus} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Performance</p>
                    <p className="font-medium text-foreground">{enrollment.performanceRating != null ? `${enrollment.performanceRating}/5` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium text-foreground">{formatDate(enrollment.internshipStartDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="font-medium text-foreground">{formatDate(enrollment.internshipEndDate)}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No internship enrollment on record yet.</p>
            )}
          </CardContent>
        </Card>

        {docs ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Document Status</CardTitle>
              <Badge value={docs.stage} />
            </CardHeader>
            <CardContent className="space-y-4 pb-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Required documents verified</span>
                  <span className="text-muted-foreground">{docs.verification.verifiedRequired}/{docs.verification.totalRequired}</span>
                </div>
                <Progress value={(docs.verification.verifiedRequired / docs.verification.totalRequired) * 100} />
              </div>
              {missingDocs.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing / Action Needed</p>
                  <ul className="list-inside list-disc text-sm text-foreground">
                    {missingDocs.map((t) => <li key={t}>{DOC_TYPE_LABELS[t]}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">All required documents uploaded.</p>
              )}
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Profile Completion</span>
                  <span className="font-medium text-foreground">{docs.profileCompletionPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Hours Logged (30d)</span>
                  <span className="font-medium text-foreground">{me.hoursLoggedLast30}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Document Status</CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="py-8 text-center text-sm text-muted-foreground">No document records available yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>My Tasks</CardTitle>
              <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="pb-5">
              <Table columns={myTasksColumns} rows={recentTasks} emptyMessage="No tasks assigned yet." />
            </CardContent>
          </Card>
          <ActivityList
            title="Recent Work Updates"
            items={workUpdateItems}
            emptyMessage="No work updates submitted yet."
            viewAllTo="/work-updates"
          />
        </div>
        <div className="space-y-4">
          <QuickActions actions={QUICK_ACTIONS} />
          <ActivityList title="Notifications" items={notificationItems} emptyMessage="No notifications yet." />
          <InsightsPanel insights={internInsights(me, enrollment)} />
        </div>
      </div>
    </div>
  );
}
