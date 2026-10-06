import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/layout/UserMenu';
import GlobalSearch from '@/components/layout/GlobalSearch';
import { useAuth } from '@/context/AuthContext';

export default function TopBar({ onMenuClick }) {
  const { user } = useAuth();
  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
        {isManager && <GlobalSearch />}
      </div>

      {/* The sidebar (desktop: Sidebar.jsx footer, mobile: MobileSidebar's
          drawer footer) now shows the same profile menu with the role
          already visible underneath the name — showing it again here too
          would just be the same information twice. Desktop's sidebar is
          always on screen, so this is hidden there entirely; on
          mobile/tablet the sidebar is a drawer that isn't open by default,
          so this stays as the one always-visible way to reach profile/
          logout without first opening it. */}
      <div className="flex items-center gap-2 lg:hidden">
        <UserMenu />
      </div>
    </header>
  );
}
