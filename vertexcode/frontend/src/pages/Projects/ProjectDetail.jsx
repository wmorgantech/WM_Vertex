import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${id}`).then(({ data }) => setProject(data.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!project) return <div className="empty-state">Project not found.</div>;

  const columns = [
    { key: 'title', header: 'Task' },
    { key: 'assignee', header: 'Assignee', render: (r) => `${r.assignee.firstName} ${r.assignee.lastName}` },
    { key: 'priority', header: 'Priority', render: (r) => <Badge value={r.priority} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'progress', header: 'Progress', render: (r) => `${r.progress}%` },
  ];

  return (
    <div>
      <PageHeader title={project.name} subtitle={project.description} />
      <div className="card-grid">
        <div className="card">
          <h3>Details</h3>
          <dl className="detail-list">
            <dt>Manager</dt><dd>{project.manager.firstName} {project.manager.lastName}</dd>
            <dt>Status</dt><dd><Badge value={project.status} /></dd>
            <dt>Members</dt><dd>{project.members.map((m) => `${m.user.firstName} ${m.user.lastName}`).join(', ') || '—'}</dd>
          </dl>
        </div>
      </div>
      <h3 style={{ marginTop: 24 }}>Tasks</h3>
      <DataTable columns={columns} rows={project.tasks} />
    </div>
  );
}
