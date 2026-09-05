import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Building2,
  FolderKanban,
  ListChecks,
  Clock,
  FileClock,
  FileText,
  FolderOpen,
  BarChart3,
  Sliders,
  ShieldCheck,
  History,
  School,
  Presentation,
  FileSignature,
  Bell,
  CalendarOff,
  ListPlus,
  FileCog,
  IndianRupee,
  MessageSquare,
} from 'lucide-react';

// Route access is unchanged from the original NAV_BY_ROLE map in DashboardLayout —
// this file only adds grouping + icons for the redesigned sidebar.
const MANAGER_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/interns', label: 'Interns', icon: GraduationCap },
      { to: '/trainees', label: 'Trainees', icon: GraduationCap },
      { to: '/documents', label: 'Intern Documents', icon: FolderOpen },
      { to: '/departments', label: 'Departments', icon: Building2 },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/tasks', label: 'Tasks', icon: ListChecks },
    ],
  },
  {
    label: 'Business Development',
    items: [
      { to: '/colleges', label: 'Colleges', icon: School },
      { to: '/workshops', label: 'Workshops', icon: Presentation },
      { to: '/mous', label: 'MOUs', icon: FileSignature },
      { to: '/enquiries', label: 'Enquiries', icon: MessageSquare },
    ],
  },
  {
    label: 'Time',
    items: [
      { to: '/attendance', label: 'Attendance', icon: Clock },
      { to: '/timesheets', label: 'Timesheets', icon: FileClock },
      { to: '/work-updates', label: 'Work Updates', icon: FileText },
      { to: '/leave', label: 'Leave', icon: CalendarOff },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }],
  },
];

// Expenses is Super Admin-only (hardcoded business rule — see
// backend/src/routes/expense.routes.js), not part of MANAGER_GROUPS shared
// with Admin.
const FINANCE_GROUP = {
  label: 'Finance',
  items: [{ to: '/expenses', label: 'Expenses', icon: IndianRupee }],
};

// Super Admin doesn't need the Enquiries workflow (it's an Admin/Employee
// business-development tool) — dropped from the shared MANAGER_GROUPS list
// for Super Admin's nav only. Admin still gets the full, unmodified
// MANAGER_GROUPS (including Enquiries) below. This is a navigation-only
// change: the /enquiries route, its API, and Admin's access are untouched.
const SUPER_ADMIN_GROUPS = [
  ...MANAGER_GROUPS.map((group) =>
    group.label === 'Business Development'
      ? { ...group, items: group.items.filter((item) => item.to !== '/enquiries') }
      : group
  ),
  FINANCE_GROUP,
  {
    label: 'Configuration',
    items: [
      { to: '/configuration/masters', label: 'Master Data', icon: Sliders },
      { to: '/configuration/permissions', label: 'Admin Permissions', icon: ShieldCheck },
      { to: '/configuration/audit-log', label: 'Audit Log', icon: History },
      { to: '/configuration/notifications', label: 'Notifications', icon: Bell },
      { to: '/configuration/custom-fields', label: 'Custom Fields', icon: ListPlus },
      { to: '/configuration/document-settings', label: 'Document Settings', icon: FileCog },
    ],
  },
];

const SELF_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'My Work',
    items: [
      { to: '/tasks', label: 'My Tasks', icon: ListChecks },
      { to: '/attendance', label: 'Attendance', icon: Clock },
      { to: '/timesheets', label: 'Timesheets', icon: FileClock },
      { to: '/work-updates', label: 'Work Updates', icon: FileText },
      { to: '/leave', label: 'Leave', icon: CalendarOff },
      { to: '/workshops', label: 'My Workshops', icon: Presentation },
      { to: '/enquiries', label: 'My Enquiries', icon: MessageSquare },
    ],
  },
];

const INTERN_GROUPS = [
  SELF_GROUPS[0],
  {
    ...SELF_GROUPS[1],
    items: [...SELF_GROUPS[1].items, { to: '/documents', label: 'Documents', icon: FolderOpen }],
  },
];

// Employee-only: read-only "My Expenses" (see expense.routes.js/
// expense.controller.js — scoped server-side to their own records). Built
// as its own array on top of SELF_GROUPS rather than appended directly to
// it, so INTERN_GROUPS (which also derives from SELF_GROUPS above) doesn't
// inherit it — Interns were not asked for this and get no such access.
const EMPLOYEE_GROUPS = [
  SELF_GROUPS[0],
  {
    ...SELF_GROUPS[1],
    items: [...SELF_GROUPS[1].items, { to: '/expenses', label: 'My Expenses', icon: IndianRupee }],
  },
];

const TRAINEE_GROUPS = [
  { label: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'My Training',
    items: [
      { to: '/attendance', label: 'Attendance', icon: Clock },
      { to: '/leave', label: 'Leave', icon: CalendarOff },
    ],
  },
];

export const NAV_GROUPS_BY_ROLE = {
  SUPER_ADMIN: SUPER_ADMIN_GROUPS,
  ADMIN: MANAGER_GROUPS,
  EMPLOYEE: EMPLOYEE_GROUPS,
  INTERN: INTERN_GROUPS,
  TRAINEE: TRAINEE_GROUPS,
};

// Designation that additionally grants an Employee the ability to add
// interns (see backend intern.routes.js canAddIntern) — surfaced here too
// so they get a nav link to actually reach the page.
const SENIOR_FULLSTACK_DESIGNATION = 'Senior Full Stack Developer';

export function getNavGroups(user) {
  const role = user?.role;
  const groups = NAV_GROUPS_BY_ROLE[role] || SELF_GROUPS;

  if (role === 'EMPLOYEE' && user?.designation === SENIOR_FULLSTACK_DESIGNATION) {
    return groups.map((g) => (
      g.label === 'My Work'
        ? { ...g, items: [...g.items, { to: '/interns', label: 'Interns', icon: GraduationCap }] }
        : g
    ));
  }

  return groups;
}
