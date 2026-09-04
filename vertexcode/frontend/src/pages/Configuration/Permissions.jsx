import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

// Every (module, action) pair the Admin role can be granted. Unlisted pairs
// simply aren't configurable — Super Admin retains those unconditionally.
// This list is authoritative and kept in sync with every can('module','action')
// check in the backend routes — it is not a generic CRUD shape (actions are
// whatever that module actually supports, e.g. 'manage', 'assign', 'review').
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

const MODULE_DESCRIPTIONS = {
  department: 'Create and edit organizational departments',
  project: 'Create, edit and assign projects',
  task: 'Create new tasks',
  timesheet: 'Approve or reject submitted timesheets',
  analytics: 'View organization-wide analytics and reports',
  attendance: 'View and mark employee attendance',
  user: 'View and create employee accounts',
  document: 'Review and approve intern document submissions',
  intern: 'Manage intern enrollments and batches',
  trainee: 'Manage trainee enrollments and programs',
  workupdate: 'Review daily work updates',
  college: 'Manage college and institution records',
  mou: 'Manage memorandums of understanding',
  workshop: 'Manage the workshop pipeline',
  leave: 'Approve leave requests',
};

const ACTION_LABELS = {
  view: 'View', create: 'Create', edit: 'Edit', assign: 'Assign', approve: 'Approve',
  reject: 'Reject', manage: 'Manage', review: 'Review', mark: 'Mark',
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

  const setModule = (module, allowed) => {
    setMatrix((m) => {
      const next = { ...m };
      MODULE_ACTIONS[module].forEach((action) => { next[`${module}:${action}`] = allowed; });
      return next;
    });
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
        title="Permission Management"
        subtitle="Control which actions the Admin role is allowed to perform. Super Admin always has full access."
        actions={<button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
      />

      <div className="permission-grid">
        {Object.entries(MODULE_ACTIONS).map(([module, actions]) => {
          const allChecked = actions.every((a) => matrix[`${module}:${a}`]);
          const noneChecked = actions.every((a) => !matrix[`${module}:${a}`]);
          return (
            <div key={module} className="permission-card">
              <div className="permission-card-header">
                <div>
                  <h3>{MODULE_LABELS[module]}</h3>
                  <p>{MODULE_DESCRIPTIONS[module]}</p>
                </div>
              </div>
              <div className="permission-card-actions">
                {actions.map((action) => (
                  <label key={action} className="permission-check">
                    <input
                      type="checkbox"
                      checked={!!matrix[`${module}:${action}`]}
                      onChange={() => toggle(module, action)}
                    />
                    {ACTION_LABELS[action] || action}
                  </label>
                ))}
              </div>
              <div className="permission-card-footer">
                <button type="button" className="link-btn" disabled={allChecked} onClick={() => setModule(module, true)}>Select All</button>
                <span className="permission-card-sep">·</span>
                <button type="button" className="link-btn" disabled={noneChecked} onClick={() => setModule(module, false)}>Clear All</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
