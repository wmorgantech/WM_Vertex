import { useEffect, useState } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

// Every (module, action) pair the Admin role can be granted. Unlisted pairs
// simply aren't configurable — Super Admin retains those unconditionally.
// This list is authoritative and kept in sync with every can('module','action')
// check in the backend routes — it is not a generic CRUD shape (actions are
// whatever that module actually supports, e.g. 'manage', 'assign', 'review').
// UNCHANGED from before this redesign — no permission was added or removed.
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

// Plain-CSS toggle (not the shadcn/Radix Switch) so it visually matches this
// page's existing design language exactly, rather than mixing two component
// systems' color tokens on one screen.
function ModuleToggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`module-toggle${checked ? ' is-on' : ''}`}
      onClick={onChange}
    >
      <span className="module-toggle-thumb" />
    </button>
  );
}

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

  // Global Select All / Uncheck All — same MODULE_ACTIONS set as everything
  // else here, just applied across every module in one action instead of
  // one at a time.
  const setAllModules = (allowed) => {
    setMatrix((m) => {
      const next = { ...m };
      Object.entries(MODULE_ACTIONS).forEach(([module, actions]) => {
        actions.forEach((action) => { next[`${module}:${action}`] = allowed; });
      });
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
        actions={(
          <>
            <Link to="/employees" className="btn btn-secondary"><Users size={14} /> Users &amp; Roles</Link>
            <button type="button" className="btn btn-secondary" onClick={() => setAllModules(false)}>Uncheck All</button>
            <button type="button" className="btn btn-secondary" onClick={() => setAllModules(true)}>Select All</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        )}
      />

      {/* Role context — VertexWM has a fixed set of system roles (Prisma
          enum), and only Admin's permissions are configurable through this
          matrix (Super Admin always has full access unconditionally), so
          this is a role indicator rather than a functional role switcher.
          "+ New Role"/"Delete Role" are shown for layout familiarity but are
          intentionally disabled — creating/deleting a role isn't something
          VertexWM's role model supports without a schema change, which is
          out of scope here. */}
      <div className="permission-role-header">
        <div className="permission-role-header-icon"><ShieldCheck size={20} /></div>
        <div className="permission-role-header-body">
          <label htmlFor="permission-role-select">Select Role to Modify</label>
          <select id="permission-role-select" value="ADMIN" disabled>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div className="permission-role-header-actions">
          <button type="button" className="btn btn-ghost" disabled title="Not available — VertexWM uses a fixed set of system roles">+ New Role</button>
          <button type="button" className="btn btn-ghost" disabled title="Not available — VertexWM uses a fixed set of system roles">Delete Role</button>
        </div>
      </div>
      <p className="permission-role-hint">
        Super Admin always has full access and isn't configurable here. VertexWM's roles are fixed (Super Admin, Admin, Employee, Intern, Trainee) — only Admin's permissions can be adjusted below.
      </p>

      <div className="permission-grid">
        {Object.entries(MODULE_ACTIONS).map(([module, actions]) => {
          const allChecked = actions.every((a) => matrix[`${module}:${a}`]);
          return (
            <div key={module} className="permission-card">
              <div className="permission-card-header">
                <div>
                  <h3>{MODULE_LABELS[module]}</h3>
                  <p>{MODULE_DESCRIPTIONS[module]}</p>
                </div>
                <ModuleToggle
                  checked={allChecked}
                  onChange={() => setModule(module, !allChecked)}
                  label={`${allChecked ? 'Disable' : 'Enable'} all ${MODULE_LABELS[module]} permissions`}
                />
              </div>
              <div className="permission-row-list">
                {actions.map((action) => (
                  <label key={action} className="permission-row">
                    <input
                      type="checkbox"
                      checked={!!matrix[`${module}:${action}`]}
                      onChange={() => toggle(module, action)}
                    />
                    {ACTION_LABELS[action] || action}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
