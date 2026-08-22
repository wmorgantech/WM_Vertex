import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import toast from 'react-hot-toast';

export default function EmployeeDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = () => {
    setLoading(true);
    api.get(`/users/${id}`).then(({ data }) => { setUser(data.data); setStatus(data.data.status); }).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleStatusUpdate = async () => {
    try {
      await api.put(`/users/${id}`, { status });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <div className="empty-state">Employee not found.</div>;

  return (
    <div>
      <PageHeader title={`${user.firstName} ${user.lastName}`} subtitle={user.designation || user.role} />

      <div className="card-grid">
        <div className="card">
          <h3>Profile</h3>
          <dl className="detail-list">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Phone</dt><dd>{user.phone || '—'}</dd>
            <dt>Role</dt><dd><Badge value={user.role} /></dd>
            <dt>Employment Type</dt><dd>{user.employmentType}</dd>
            <dt>Department</dt><dd>{user.department?.name || '—'}</dd>
            <dt>Manager</dt><dd>{user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : '—'}</dd>
            <dt>Join Date</dt><dd>{new Date(user.joinDate).toLocaleDateString()}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Employment Status</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
            <option value="ALUMNI">Alumni</option>
          </select>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleStatusUpdate}>Update Status</button>
        </div>

        <div className="card">
          <h3>Direct Reports</h3>
          {user.directReports?.length ? (
            <ul className="simple-list">
              {user.directReports.map((r) => <li key={r.id}>{r.firstName} {r.lastName} — {r.designation || r.role}</li>)}
            </ul>
          ) : <div className="empty-state">No direct reports.</div>}
        </div>
      </div>
    </div>
  );
}
