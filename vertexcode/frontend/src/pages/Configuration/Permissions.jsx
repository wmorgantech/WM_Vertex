import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

// Every (module, action) pair the Admin role can be granted. Unlisted pairs
// simply aren't configurable — Super Admin retains those unconditionally.
const MODULE_ACTIONS = {
  department: ['create', 'edit'],
  project: ['create', 'edit', 'assign'],
  task: ['create'],
  timesheet: ['approve', 'reject'],
  analytics: ['view'],
  attendance: ['view', 'mark'],
  user: ['view', 'create'],
  document: ['view', 'approve', 'reject'],
  intern: ['manage'],
  trainee: ['manage'],
  workupdate: ['review'],
  college: ['manage'],
  mou: ['manage'],
  workshop: ['manage'],
  leave: ['approve'],
};

const MODULE_LABELS = {
  department: 'Departments', project: 'Projects', task: 'Tasks', timesheet: 'Timesheets',
  analytics: 'Analytics', attendance: 'Attendance', user: 'Users', document: 'Intern Documents',
  intern: 'Interns', trainee: 'Trainees', workupdate: 'Work Updates',
  college: 'Colleges', mou: 'MOUs', workshop: 'Workshops', leave: 'Leave',
};

export default function Permissions() {
  const [matrix, setMatrix] = useState({}); // { 'module:action': boolean }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/permissions').then(({ data }) => {
      const map = {};
      data.data.forEach((p) => { map[`${p.module}:${p.action}`] = p.allowed; });
      setMatrix(map);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = (module, action) => {
    const key = `${module}:${action}`;
    setMatrix((m) => ({ ...m, [key]: !m[key] }));
  };

  const save = async () => {
    setSaving(true);
    const permissions = Object.entries(MODULE_ACTIONS).flatMap(([module, actions]) =>
      actions.map((action) => ({ module, action, allowed: !!matrix[`${module}:${action}`] }))
    );
    try {
      await api.put('/permissions', { permissions });
      toast.success('Admin permissions updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div>
      <PageHeader
        title="Configuration — Admin Permissions"
        subtitle="Control which actions the Admin role is allowed to perform. Super Admin always has full access."
        actions={<button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Action</th>
              <th>Allowed for Admin</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(MODULE_ACTIONS).flatMap(([module, actions]) =>
              actions.map((action, i) => (
                <tr key={`${module}:${action}`}>
                  {i === 0 && <td rowSpan={actions.length} style={{ fontWeight: 600 }}>{MODULE_LABELS[module]}</td>}
                  <td style={{ textTransform: 'capitalize' }}>{action}</td>
                  <td>
                    <button
                      type="button"
                      className={`badge badge-${matrix[`${module}:${action}`] ? 'green' : 'gray'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => toggle(module, action)}
                    >
                      {matrix[`${module}:${action}`] ? 'Allowed' : 'Denied'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
