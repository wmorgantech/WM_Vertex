import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Timer, TrendingUp, Star, UserCog, FileClock, NotebookPen, ListChecks, Clock, FolderOpen } from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import ActivityList from '@/components/shared/ActivityList';
import QuickActions from '@/components/shared/QuickActions';
import InsightsPanel from '@/components/shared/InsightsPanel';
import Badge from '@/components/shared/Badge';
import PieChart from '@/components/shared/charts/PieChart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ClockCard } from '@/pages/Dashboard/EmployeeDashboard';
import { internInsights } from '@/lib/dashboardInsights';

const REQUIRED_DOC_TYPES = ['BONAFIDE', 'COLLEGE_ID'];
const DOC_TYPE_LABELS = { BONAFIDE: 'Bonafide Certificate', COLLEGE_ID: 'College ID Card' };

const QUICK_ACTIONS = [
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/attendance', label: 'Attendance', icon: Clock },
  { to: '/timesheets', label: 'Log Time', icon: FileClock },
  { to: '/work-updates', label: 'Submit Work Update', icon: NotebookPen },
  { to: '/documents', label: 'My Documents', icon: FolderOpen },
];

export default function InternDashboard() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/analytics/me'), api.get('/tasks'), api.get('/interns/enrollments'), api.get('/documents/mine').catch(() => null)])
      .then(([perf, t, enr, docsRes]) => {
        setMe(perf.data.data);
        setTasks(t.data.data);
        const mine = enr.data.data.find((e) => e.user.id === user.id);
        setEnrollment(mine || null);
        setDocs(docsRes?.data.data || null);
      })
      .finally(() => setLoading(false));
  }, [user.id]);

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

  const mentorName = enrollment?.mentor ? `${enrollment.mentor.firstName} ${enrollment.mentor.lastName}` : 'Not assigned';

  const missingDocs = docs
    ? REQUIRED_DOC_TYPES.filter((t) => {
        const doc = docs.documents.find((d) => d.type === t);
        return !doc || doc.status === 'REJECTED';
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="My Internship" subtitle="Your program progress, tasks and attendance" />

      <ClockCard />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Tasks Completed" value={me.tasks.done} hint={`${me.tasks.total} total`} icon={CheckCircle2} accent="success" />
        <KpiCard label="Overdue Tasks" value={me.tasks.overdue} icon={AlertCircle} accent="destructive" />
        <KpiCard label="Hours Logged (30d)" value={me.hoursLoggedLast30} icon={Timer} accent="primary" />
        <KpiCard
          label="Program Progress"
          value={enrollment ? `${enrollment.progressPercent}%` : '—'}
          icon={TrendingUp}
          accent="info"
        />
        <KpiCard
          label="Performance Rating"
          value={enrollment?.performanceRating != null ? `${enrollment.performanceRating}/5` : '—'}
          icon={Star}
          accent="purple"
        />
        <KpiCard label="Mentor" value={mentorName} icon={UserCog} accent="warning" />
        {docs && (
          <KpiCard label="Profile Completion" value={`${docs.profileCompletionPercent}%`} icon={FolderOpen} accent="info" />
        )}
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
            <CardTitle>Program Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            {enrollment ? (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{enrollment.batch?.name}</span>
                    <span className="text-muted-foreground">{enrollment.progressPercent}%</span>
                  </div>
                  <Progress value={enrollment.progressPercent} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge value={enrollment.completionStatus} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mentor</span>
                  <span className="font-medium text-foreground">{mentorName}</span>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No internship enrollment on record yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {docs && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Internship Status</CardTitle>
            <div className="flex items-center gap-2">
              {docs.enrollment.category && <Badge value={docs.enrollment.category} />}
              <Badge value={docs.stage} />
            </div>
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
                <span className="text-muted-foreground">Offer Letter</span>
                <span className="font-medium text-foreground">{docs.offerLetter ? 'Generated' : 'Not yet generated'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Certificate</span>
                <span className="font-medium text-foreground">{docs.certificate ? 'Generated' : 'Not yet generated'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          <InsightsPanel insights={internInsights(me, enrollment)} />
        </div>
      </div>
    </div>
  );
}
