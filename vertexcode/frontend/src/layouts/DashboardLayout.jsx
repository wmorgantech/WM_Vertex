import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { useSidebarCollapsed } from '@/components/layout/Sidebar';
import MobileSidebar from '@/components/layout/MobileSidebar';
import TopBar from '@/components/layout/TopBar';
import { useAuth } from '@/context/AuthContext';

export default function DashboardLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  // The WMorgan green employee-portal theme (index.css:
  // body.vx-theme-employee) is scoped to a body class rather than a
  // wrapper div's class, so it reaches both this Tailwind shell AND the
  // legacy CSS-class-based pages (Tasks/Attendance/Timesheets/etc., which
  // render inside <Outlet/> but aren't part of the .vx-app Tailwind tree)
  // from one place. EMPLOYEE only — every other role's theme is
  // unaffected. Cleaned up on unmount/role change so switching accounts or
  // leaving the dashboard never leaves the class behind.
  useEffect(() => {
    const isEmployee = user?.role === 'EMPLOYEE';
    document.body.classList.toggle('vx-theme-employee', isEmployee);
    return () => document.body.classList.remove('vx-theme-employee');
  }, [user?.role]);

  return (
    <div className="vx-app flex h-screen w-full overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} className="hidden lg:flex" />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
