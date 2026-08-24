import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Timer, FileClock, NotebookPen, CalendarCheck, LogIn, LogOut, ListChecks, Clock } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import ActivityList from '@/components/shared/ActivityList';
import QuickActions from '@/components/shared/QuickActions';
import InsightsPanel from '@/components/shared/InsightsPanel';
import PieChart from '@/components/shared/charts/PieChart';
import LineChart from '@/components/shared/charts/LineChart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { selfInsights } from '@/lib/dashboardInsights';
import { localDateString } from '@/lib/utils';

const QUICK_ACTIONS = [
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/attendance', label: 'Attendance', icon: Clock },
  { to: '/timesheets', label: 'Log Time', icon: FileClock },
  { to: '/work-updates', label: 'Submit Work Update', icon: NotebookPen },
];

export function useClockWidget() {
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [clocking, setClocking] = useState(false);

  const load = () => {
    api.get('/attendance/me').then(({ data }) => {
      const today = localDateString();
      const todays = data.data.find((a) => a.date.slice(0, 10) === today);
      setAttendanceToday(todays || null);
    });
  };

  useEffect(load, []);

  const handleClock = async (type) => {
    setClocking(true);
    try {
      await api.post(`/attendance/${type}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setClocking(false);
    }
  };

  return { attendanceToday, clocking, handleClock };
}

export function ClockCard() {
  const { attendanceToday, clocking, handleClock } = useClockWidget();

  return (
    <Card>
      <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarCheck className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Today's Attendance</p>
            <p className="text-xs text-muted-foreground">
              {attendanceToday?.clockIn
                ? `Clocked in at ${new Date(attendanceToday.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Not clocked in yet'}
              {attendanceToday?.clockOut
                ? ` · Clocked out at ${new Date(attendanceToday.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={clocking || attendanceToday?.clockIn}
            onClick={() => handleClock('clock-in')}
          >
            <LogIn /> Clock In
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={clocking || !attendanceToday?.clockIn || attendanceToday?.clockOut}
            onClick={() => handleClock('clock-out')}
          >
            <LogOut /> Clock Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmployeeDashboard() {
  const [me, setMe] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/analytics/me'), api.get('/tasks')])
      .then(([perf, t]) => {
        setMe(perf.data.data);
        setTasks(t.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!me) {
    return <p className="text-sm text-muted-foreground">No dashboard data available.</p>;
  }

  const records = me.attendance?.last30Days || [];
  const statusCounts = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const attendanceChartData = Object.entries(statusCounts).map(([status, count]) => ({
    status: status.replace('_', ' '),
    count,
  }));
  const presentDays = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;

  const hoursTrend = [...records]
    .filter((r) => r.workHours != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((r) => ({ day: format(new Date(r.date), 'MMM d'), hours: r.workHours }));

  const upcomingTasks = [...tasks]
    .filter((t) => t.status !== 'DONE' && t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.project?.name || 'No project',
      meta: new Date(t.dueDate).toLocaleDateString(),
      badgeValue: t.status,
    }));

  return (
    <div className="space-y-6">
      <PageHeader title="My Workspace" subtitle="Your tasks, attendance and performance snapshot" />

      <ClockCard />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Tasks Completed" value={me.tasks.done} hint={`${me.tasks.total} total`} icon={CheckCircle2} accent="success" />
        <KpiCard label="Overdue Tasks" value={me.tasks.overdue} icon={AlertCircle} accent="destructive" />
        <KpiCard label="Hours Logged (30d)" value={me.hoursLoggedLast30} icon={Timer} accent="primary" />
        <KpiCard label="Pending Timesheets" value={me.pendingTimesheets} icon={FileClock} accent="warning" />
        <KpiCard label="Work Updates (30d)" value={me.workUpdatesSubmittedLast30} icon={NotebookPen} accent="purple" />
        <KpiCard label="Present Days (30d)" value={presentDays} hint={`of ${records.length} tracked`} icon={CalendarCheck} accent="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {attendanceChartData.length > 0 ? (
              <PieChart data={attendanceChartData} dataKey="count" nameKey="status" />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No attendance records yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hours Worked Trend</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {hoursTrend.length > 0 ? (
              <LineChart data={hoursTrend} dataKey="hours" nameKey="day" />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No hours logged yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityList
            title="Upcoming Tasks"
            items={upcomingTasks}
            emptyMessage="No upcoming deadlines — you're all caught up."
            viewAllTo="/tasks"
          />
        </div>
        <div className="space-y-4">
          <QuickActions actions={QUICK_ACTIONS} />
          <InsightsPanel insights={selfInsights(me)} />
        </div>
      </div>
    </div>
  );
}
