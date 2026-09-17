import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Building2,
  FolderKanban,
  ListChecks,
  Clock,
  FileClock,
  FileText,
  FolderOpen,
  BarChart3,
  FileBarChart,
  Sliders,
  ShieldCheck,
  History,
  School,
  Presentation,
  FileSignature,
  CalendarOff,
  IndianRupee,
  MessageSquare,
  CalendarClock,
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
      { to: '/trainees', label: 'Trainees', icon: BookOpen },
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

// Super Admin's nav — a fixed, self-contained structure (not derived from
// MANAGER_GROUPS, which stays exactly as-is for Admin below) per the
// corporate-level sidebar audit/redesign. Every route/permission here is
// pre-existing and untouched — this file only changes grouping, labels and
// icons:
//   - Enquiries is now its own top-level group for Super Admin (previously
//     filtered out of the shared list — the /enquiries route and its API
//     already allowed SUPER_ADMIN; only the nav link was hidden).
//   - Colleges moved from "Business Development" into "People &
//     Organization"; Workshops/MOUs became their own "Programs &
//     Partnerships" group; Work Updates moved from time-tracking into
//     "Work Management" alongside Projects/Tasks.
//   - Reports is a new nav entry pointing at a new, minimal frontend page
//     (pages/Reports/Reports.jsx) that consolidates the existing
//     GET /reports/* export endpoints (previously only reachable as
//     "Export CSV/Excel" buttons scattered across each module page) — no
//     backend change, no new capability, just one findable home for them.
//   - Intern Documents, Notification Settings, Custom Fields and Document
//     Settings are intentionally no longer in the sidebar (routes/pages
//     still exist, unregistered from App.jsx untouched, reachable by
//     direct URL — this is a nav-only hide, not a removal).
//   - "Admin Permissions" is relabeled "Permissions" and "Master Data"
//     moved to its own "Configuration" group, separate from
//     "Administration" (Permissions + Audit Log).
const SUPER_ADMIN_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'People & Organization',
    items: [
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/interns', label: 'Interns', icon: GraduationCap },
      { to: '/trainees', label: 'Trainees', icon: BookOpen },
      { to: '/colleges', label: 'Colleges', icon: School },
      { to: '/departments', label: 'Departments', icon: Building2 },
    ],
  },
  {
    label: 'Work Management',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/tasks', label: 'Tasks', icon: ListChecks },
      { to: '/work-updates', label: 'Work Updates', icon: FileText },
    ],
  },
  {
    label: 'Time & Attendance',
    items: [
      { to: '/attendance', label: 'Attendance', icon: Clock },
      { to: '/leave', label: 'Leave', icon: CalendarOff },
      { to: '/timesheets', label: 'Timesheets', icon: FileClock },
    ],
  },
  {
    label: 'Enquiries',
    items: [{ to: '/enquiries', label: 'Enquiries', icon: MessageSquare }],
  },
  {
    label: 'Finance',
    items: [{ to: '/expenses', label: 'Expenses', icon: IndianRupee }],
  },
  {
    label: 'Programs & Partnerships',
    items: [
      { to: '/workshops', label: 'Workshops', icon: Presentation },
      { to: '/mous', label: 'MOUs', icon: FileSignature },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/configuration/permissions', label: 'Permissions', icon: ShieldCheck },
      { to: '/configuration/audit-log', label: 'Audit Log', icon: History },
    ],
  },
  {
    label: 'Configuration',
    items: [{ to: '/configuration/masters', label: 'Master Data', icon: Sliders }],
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
    label: 'My Program',
    items: [
      { to: '/my-program', label: 'My Program', icon: BookOpen },
      { to: '/my-curriculum', label: 'Curriculum', icon: GraduationCap },
      { to: '/my-sessions', label: 'Sessions', icon: CalendarClock },
      { to: '/my-payments', label: 'Payments', icon: IndianRupee },
    ],
  },
  {
    // Timesheets and Work Updates deliberately omitted — both are
    // Employee/Intern-specific corporate work-tracking concepts a Trainee
    // has no real use for: Timesheets logs billable hours by Designation
    // ("position") against a Project (WeeklyGrid.jsx — "Position dropdown
    // is sourced from the existing Designation master"), and Work Updates
    // is department-scoped (workupdate.controller.js's `departmentId`
    // filter) — Trainees belong to a TrainingProgram/TraineeEnrollment, not
    // a Department or a Project, so neither concept applies. The
    // "what was covered / what's pending" reporting a Work Update would
    // otherwise capture is already covered, trainee-side, by the
    // trainer-authored Sessions log under My Program above.
    label: 'My Training',
    items: [
      { to: '/tasks', label: 'My Tasks', icon: ListChecks },
      { to: '/attendance', label: 'Attendance', icon: Clock },
      { to: '/leave', label: 'Leave', icon: CalendarOff },
    ],
  },
];

// Minimal HOD/Staff nav — deliberately narrower than SELF_GROUPS: no
// Enquiries/Workshops links, since those roles aren't in ENQUIRY_PAGE_ROLES
// in App.jsx (a link to a page they'd be bounced out of is worse than no
// link). No college/department-scoped data pages yet either — that needs a
// real College<->User relationship that doesn't exist in the schema today
// (see schema.prisma Role enum comment); this is the safe stub pending that.
const HOD_STAFF_GROUPS = [
  { label: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'My Work',
    items: [
      { to: '/tasks', label: 'My Tasks', icon: ListChecks },
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
  HOD: HOD_STAFF_GROUPS,
  STAFF: HOD_STAFF_GROUPS,
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
