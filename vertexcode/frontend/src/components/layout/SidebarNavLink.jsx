import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Shared by Sidebar.jsx (desktop) and MobileSidebar.jsx (drawer) so the
// active/hover treatment is defined exactly once and can't drift between
// the two. Active state: a filled left accent bar + tinted background +
// primary-colored icon/label — a clearer, more standard enterprise-nav
// pattern than a plain background tint alone. Icon colors otherwise stay
// neutral (muted-foreground) rather than per-item colors, matching the
// "restrained palette" the rest of the design already uses.
export default function SidebarNavLink({ item, collapsed, onClick, className }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 overflow-hidden rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary/8 text-primary'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          className
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          />
          <item.icon className="size-4 shrink-0" />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
