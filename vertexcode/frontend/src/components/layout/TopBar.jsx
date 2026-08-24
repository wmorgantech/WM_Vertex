import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import UserMenu from '@/components/layout/UserMenu';
import NotificationBell from '@/components/layout/NotificationBell';
import GlobalSearch from '@/components/layout/GlobalSearch';
import { useAuth } from '@/context/AuthContext';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  INTERN: 'Intern',
  TRAINEE: 'Trainee',
};

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

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {ROLE_LABELS[user?.role] || user?.role}
        </Badge>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
