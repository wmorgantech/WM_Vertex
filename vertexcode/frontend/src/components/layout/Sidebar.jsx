import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getNavGroups } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import SidebarNavLink from './SidebarNavLink';
import UserMenu from './UserMenu';
import wmMark from '@/assets/wmorgan-mark.png';

const STORAGE_KEY = 'vertexwm_sidebar_collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return [collapsed, setCollapsed];
}

function NavItem({ item, collapsed }) {
  const link = <SidebarNavLink item={item} collapsed={collapsed} />;

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export default function Sidebar({ collapsed, onToggle, className }) {
  const { user } = useAuth();
  const groups = getNavGroups(user);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
        {/* Real WMorgan mark, unmodified (no filter/recolor) — same asset
            and framing convention as the login page's branding panel. */}
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5">
          <img src={wmMark} alt="WMorgan Technologies" className="h-full w-full object-cover" />
        </div>
        {!collapsed && <span className="truncate text-sm font-semibold tracking-tight">WMorgan Technologies</span>}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <UserMenu collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'mt-1 flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            !collapsed && 'ml-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
