import { ListChecks, Clock, CalendarOff } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import QuickActions from '@/components/shared/QuickActions';
import { ClockCard } from './EmployeeDashboard';

const QUICK_ACTIONS = [
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/attendance', label: 'Attendance', icon: Clock },
  { to: '/leave', label: 'Leave', icon: CalendarOff },
];

// Minimal dashboard for the new HOD/Staff role stub — deliberately narrow
// (self-scoped attendance + tasks only) since there is no
// College/CollegeDepartment<->User relationship yet to scope any
// college/department-level data by (see schema.prisma Role enum comment).
export default function HodStaffDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Workspace" subtitle="Your tasks and attendance" />
      <ClockCard />
      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
