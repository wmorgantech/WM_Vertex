import { useEffect, useState } from 'react';
import { TrendingUp, CheckCircle2, AlertCircle, Wallet, UserCog, BookOpen } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import ActivityList from '@/components/shared/ActivityList';
import Badge from '@/components/shared/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ClockCard } from '@/pages/Dashboard/EmployeeDashboard';

export default function TraineeDashboard() {
  const [enrollment, setEnrollment] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainees/enrollments')
      .then(({ data }) => {
        const mine = data.data[0];
        if (!mine) return null;
        return api.get(`/trainees/enrollments/${mine.id}`).then(({ data: detail }) => {
          setEnrollment(detail.data);
          return api.get('/trainees/sessions', { params: { programId: detail.data.programId } });
        });
      })
      .then((res) => { if (res) setSessions(res.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Training" subtitle="No training program enrollment on record yet." />
        <ClockCard />
        <p className="text-sm text-muted-foreground">Contact an admin to be enrolled in a training program.</p>
      </div>
    );
  }

  const { program, mentor, progress, payment, topicProgress } = enrollment;
  const mentorName = mentor ? `${mentor.firstName} ${mentor.lastName}` : 'Not assigned';
  const progressByTopic = new Map(topicProgress.map((p) => [p.topicId, p]));

  const sessionActivity = sessions.slice(0, 6).map((s) => ({
    id: s.id,
    title: s.topic?.topic || 'General session',
    subtitle: s.topicsCovered || 'No notes recorded',
    meta: new Date(s.date).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="My Training" subtitle={program.name} />

      <ClockCard />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Training Progress" value={`${progress.completionPercent}%`} icon={TrendingUp} accent="primary" />
        <KpiCard label="Topics Completed" value={progress.completedTopics} hint={`of ${progress.totalTopics}`} icon={CheckCircle2} accent="success" />
        <KpiCard label="Topics Pending" value={progress.pendingTopics} icon={AlertCircle} accent={progress.pendingTopics > 0 ? 'warning' : 'success'} />
        <KpiCard label="Assignments Pending" value={progress.assignmentsPending} icon={BookOpen} accent={progress.assignmentsPending > 0 ? 'warning' : 'success'} />
        <KpiCard label="Mentor" value={mentorName} icon={UserCog} accent="info" />
        <KpiCard
          label="Payment Balance"
          value={payment.balance > 0 ? `₹${payment.balance.toLocaleString()}` : 'Paid'}
          icon={Wallet}
          accent={payment.balance > 0 ? 'destructive' : 'success'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Curriculum Progress</CardTitle></CardHeader>
          <CardContent className="space-y-3 pb-5">
            {program.topics.map((t) => {
              const p = progressByTopic.get(t.id);
              return (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{t.sequence}. {t.topic}</span>
                  <Badge value={p?.status || 'NOT_STARTED'} />
                </div>
              );
            })}
            <Progress value={progress.completionPercent} className="mt-2" />
          </CardContent>
        </Card>
        <ActivityList
          title="Recent Training Sessions"
          items={sessionActivity}
          emptyMessage="No sessions logged yet."
        />
      </div>
    </div>
  );
}
