import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, ListChecks, CheckCircle2, Clock4, CalendarCheck, CalendarOff, Users2 } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import QuickActions from '@/components/shared/QuickActions';
import ActivityList from '@/components/shared/ActivityList';
import KpiCard from '@/components/shared/KpiCard';
import Badge from '@/components/shared/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ClockCard } from './EmployeeDashboard';

const QUICK_ACTIONS = [
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/attendance', label: 'Attendance', icon: Clock4 },
  { to: '/leave', label: 'Leave', icon: CalendarOff },
];

const TABS = [
  { value: 'students', label: 'Students' },
  { value: 'interns', label: 'Interns' },
  { value: 'trainees', label: 'Trainees' },
];

// HOD/Staff dashboard — self-scoped attendance/tasks (unchanged) plus a
// college-scoped student/intern/trainee monitoring roster. All monitoring
// data is entirely backend-scoped to the caller's own collegeId/
// collegeDepartmentId (GET /analytics/hod-overview) — this component never
// sends or trusts a college id of its own, so there is nothing here for the
// frontend to "hide" that the backend wouldn't already withhold. HOD sees
// its whole college; Staff is narrowed to its assigned department — that
// distinction is entirely server-side (utils/hodScope.js), not rendered
// here as a filter.
export default function HodStaffDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('students');

  useEffect(() => {
    api.get('/analytics/hod-overview')
      .then(({ data }) => setOverview(data.data))
      .finally(() => setLoading(false));
  }, []);

  const scopeLabel = overview?.configured
    ? `${overview.scope.college?.name || 'Unknown college'}${overview.scope.collegeDepartment ? ` — ${overview.scope.collegeDepartment.name}` : ''}`
    : undefined;

  const rosterForTab = useMemo(() => {
    if (!overview?.configured) return [];
    if (tab === 'interns') return overview.roster.filter((r) => r.type === 'INTERN');
    if (tab === 'trainees') return overview.roster.filter((r) => r.type === 'TRAINEE');
    return overview.roster;
  }, [overview, tab]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Workspace" subtitle={scopeLabel || 'Your tasks and attendance'} />
      <ClockCard />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !overview?.configured ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Your account isn't linked to a college yet, so student/intern/trainee monitoring isn't available. Contact your administrator to have a college (and, for Staff, a department) assigned to your profile.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="Students" value={overview.summary.totalStudents} hint={`${overview.summary.activeStudents} active`} icon={Users2} accent="primary" />
            <KpiCard label="Interns" value={overview.summary.totalInterns} icon={GraduationCap} accent="info" />
            <KpiCard label="Trainees" value={overview.summary.totalTrainees} icon={GraduationCap} accent="purple" />
            <KpiCard label="Present Today" value={`${overview.summary.todayPresent}/${overview.summary.totalStudents}`} icon={CalendarCheck} accent="success" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Tasks Assigned" value={overview.tasks.assigned} icon={ListChecks} accent="info" />
            <KpiCard label="Tasks Completed" value={overview.tasks.completed} icon={CheckCircle2} accent="success" />
            <KpiCard label="Tasks Pending" value={overview.tasks.pending} icon={Clock4} accent="warning" />
          </div>

          {overview.tasks.byStatus.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Task Status</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2 pb-5">
                {overview.tasks.byStatus.map((s) => (
                  <span key={s.code} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
                    {s.label}
                    <span className="font-semibold text-foreground">{s.count}</span>
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pb-5">
              {rosterForTab.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No {tab} in your authorized scope yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {tab === 'students' && <TableHead>Type</TableHead>}
                      <TableHead>Group</TableHead>
                      <TableHead>Today's Attendance</TableHead>
                      <TableHead>Tasks (Assigned / Done / Pending)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rosterForTab.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                        {tab === 'students' && <TableCell><Badge value={r.type} /></TableCell>}
                        <TableCell className="text-muted-foreground">{r.group || '—'}</TableCell>
                        <TableCell><Badge value={r.todaysAttendance} label={r.todaysAttendance.replace(/_/g, ' ')} /></TableCell>
                        <TableCell>{r.tasksAssigned} / {r.tasksCompleted} / {r.tasksPending}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <ActivityList
            title="Latest Progress / Comments"
            items={overview.recentActivity.map((a) => ({
              id: a.id,
              title: `${a.studentName} — ${a.taskTitle}`,
              subtitle: `${a.body} · by ${a.authorName}`,
              meta: new Date(a.createdAt).toLocaleDateString(),
            }))}
            emptyMessage="No recent task progress updates for this group yet."
          />
        </>
      )}

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
