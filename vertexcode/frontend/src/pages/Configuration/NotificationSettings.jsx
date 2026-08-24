import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

const TYPE_LABELS = {
  TASK_ASSIGNED: 'Task assigned',
  TASK_OVERDUE: 'Task overdue',
  TASK_UNALLOCATED: 'Task unallocated',
  TIMESHEET_PENDING: 'Timesheet pending review',
  TIMESHEET_REJECTED: 'Timesheet rejected',
  ATTENDANCE_MISSING: 'Attendance missing',
  TRAINING_SESSION_SCHEDULED: 'Training session scheduled',
  TRAINING_TOPIC_PENDING: 'Training topic pending',
  INTERN_TASK_NOT_ALLOCATED: 'Intern task not allocated',
  PAYMENT_PENDING: 'Payment pending',
  MOU_EXPIRING: 'MOU expiring',
  WORKSHOP_FOLLOWUP_DUE: 'Workshop follow-up due',
  CERTIFICATE_GENERATED: 'Certificate generated',
  DOCUMENT_REVIEWED: 'Document reviewed',
  GENERAL: 'General',
};

export default function NotificationSettings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/notifications/settings').then(({ data }) => setSettings(data.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = (type) => {
    setSettings((s) => s.map((row) => (row.type === type ? { ...row, enabled: !row.enabled } : row)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/notifications/settings', { settings });
      toast.success('Notification settings updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div>
      <PageHeader
        title="Configuration — Notifications"
        subtitle="Turn individual notification types on or off platform-wide"
        actions={<button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Notification Type</th><th>Enabled</th></tr></thead>
          <tbody>
            {settings.map((row) => (
              <tr key={row.type}>
                <td>{TYPE_LABELS[row.type] || row.type}</td>
                <td>
                  <button
                    type="button"
                    className={`badge badge-${row.enabled ? 'green' : 'gray'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => toggle(row.type)}
                  >
                    {row.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
