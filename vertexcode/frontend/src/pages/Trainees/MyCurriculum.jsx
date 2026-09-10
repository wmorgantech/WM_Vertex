import { useEffect, useState } from 'react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import Badge from '@/components/shared/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

// Read-only by design — PATCH /trainees/enrollments/:id/topics/:topicId is
// gated can('trainee','manage') (admin/mentor only, see trainee.routes.js),
// not self-service, so there is no trainee-facing edit action here.
export default function MyCurriculum() {
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainees/enrollments')
      .then(({ data }) => {
        const mine = data.data[0];
        if (!mine) return null;
        return api.get(`/trainees/enrollments/${mine.id}`);
      })
      .then((res) => { if (res) setEnrollment(res.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-6">
        <PageHeader title="Curriculum" subtitle="No training program enrollment on record yet." />
        <p className="text-sm text-muted-foreground">Contact an admin to be enrolled in a training program.</p>
      </div>
    );
  }

  const { program, topicProgress, progress } = enrollment;
  const progressByTopic = new Map(topicProgress.map((p) => [p.topicId, p]));

  const columns = [
    { key: 'sequence', header: '#', render: (t) => t.sequence },
    { key: 'topic', header: 'Topic' },
    { key: 'hours', header: 'Expected Hours', render: (t) => t.expectedDurationHours ?? '—' },
    { key: 'status', header: 'Status', render: (t) => <Badge value={progressByTopic.get(t.id)?.status || 'NOT_STARTED'} /> },
    { key: 'assignment', header: 'Assignment', render: (t) => <Badge value={progressByTopic.get(t.id)?.assignmentStatus || 'NOT_SUBMITTED'} /> },
    { key: 'remarks', header: 'Remarks', render: (t) => progressByTopic.get(t.id)?.remarks || '—' },
    {
      key: 'completedAt', header: 'Completed On',
      render: (t) => {
        const p = progressByTopic.get(t.id);
        return p?.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—';
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Curriculum" subtitle={program.name} />

      <Card>
        <CardHeader><CardTitle>Overall Progress</CardTitle></CardHeader>
        <CardContent className="space-y-2 pb-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{progress.completedTopics} of {progress.totalTopics} topics completed</span>
            <span>{progress.completionPercent}%</span>
          </div>
          <Progress value={progress.completionPercent} />
        </CardContent>
      </Card>

      <Table columns={columns} rows={program.topics} emptyMessage="No topics have been added to this program yet." />
    </div>
  );
}
