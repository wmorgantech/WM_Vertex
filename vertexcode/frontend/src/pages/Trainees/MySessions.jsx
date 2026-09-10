import { useEffect, useState } from 'react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import { Skeleton } from '@/components/ui/skeleton';

// TrainingSession is a program-level daily training log (trainer/mentor
// notes per date) — distinct from the unrelated college-outreach Workshop
// module, which has no relation to trainees at all. This is the real,
// existing "sessions" concept for a trainee's program.
export default function MySessions() {
  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainees/enrollments')
      .then(({ data }) => {
        const mine = data.data[0];
        if (!mine) return null;
        return api.get(`/trainees/enrollments/${mine.id}`).then(({ data: detail }) => {
          setProgram(detail.data.program);
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
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="space-y-6">
        <PageHeader title="Training Sessions" subtitle="No training program enrollment on record yet." />
        <p className="text-sm text-muted-foreground">Contact an admin to be enrolled in a training program.</p>
      </div>
    );
  }

  const columns = [
    { key: 'date', header: 'Date', render: (s) => new Date(s.date).toLocaleDateString() },
    { key: 'topic', header: 'Topic', render: (s) => s.topic?.topic || 'General session' },
    { key: 'trainer', header: 'Trainer', render: (s) => s.trainer ? `${s.trainer.firstName} ${s.trainer.lastName}` : '—' },
    { key: 'covered', header: 'Topics Covered', render: (s) => s.topicsCovered || '—' },
    { key: 'pending', header: 'Topics Pending', render: (s) => s.topicsPending || '—' },
    { key: 'remarks', header: 'Remarks', render: (s) => s.remarks || '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Training Sessions" subtitle={program.name} />
      <Table columns={columns} rows={sessions} emptyMessage="No sessions logged yet." />
    </div>
  );
}
