import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { useSidebarCollapsed } from '@/components/layout/Sidebar';
import MobileSidebar from '@/components/layout/MobileSidebar';
import TopBar from '@/components/layout/TopBar';

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

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
