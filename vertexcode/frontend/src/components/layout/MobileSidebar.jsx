import { Layers } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getNavGroups } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import SidebarNavLink from './SidebarNavLink';

export default function MobileSidebar({ open, onOpenChange }) {
  const { user } = useAuth();
  const groups = getNavGroups(user);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex-row items-center gap-2 border-b border-sidebar-border">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers className="size-4" />
          </div>
          <SheetTitle className="text-sm font-semibold tracking-tight">VertexWM</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarNavLink key={item.to} item={item} onClick={() => onOpenChange(false)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
