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
    label: 'Time',
    items: [
      { to: '/attendance', label: 'Attendance', icon: Clock },
      { to: '/timesheets', label: 'Timesheets', icon: FileClock },
      { to: '/work-updates', label: 'Work Updates', icon: FileText },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }],
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

export const NAV_GROUPS_BY_ROLE = {
  SUPER_ADMIN: MANAGER_GROUPS,
  ADMIN: MANAGER_GROUPS,
  EMPLOYEE: SELF_GROUPS,
  INTERN: INTERN_GROUPS,
};

export function getNavGroups(role) {
  return NAV_GROUPS_BY_ROLE[role] || SELF_GROUPS;
}
