import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

// Generic action menu for a table row's secondary actions ("More"). Renders
// the popover into document.body via a portal and positions it with
// `position: fixed` computed from the trigger's own bounding box, rather
// than `position: absolute` inside the row — .table-wrap has
// `overflow-x: auto`, which (per the CSS spec) also computes overflow-y to
// auto, so an absolutely-positioned menu anchored inside a table cell would
// get clipped for any row near the bottom of the visible table area. Fixed
// positioning relative to the viewport, outside that overflow container
// entirely, is the only way to guarantee it never gets clipped.
//
// items: [{ key, icon, label, onClick, danger, disabled, title }] — falsy
// entries are dropped, so callers can conditionally include/exclude items
// the same way TableActions already does.
//
// The trigger defaults to the icon-only 3-dot "More" button (row actions);
// pass triggerClassName/triggerContent to reuse this same popover for a
// labeled trigger instead (e.g. a "Bulk Actions" button in a toolbar) rather
// than building a second dropdown implementation for that case.
export default function DropdownMenu({ items, label = 'More actions', align = 'end', triggerClassName = 'table-action-btn', triggerContent }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const visibleItems = (items || []).filter(Boolean);

  const computePosition = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = visibleItems.length * 36 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    return {
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      ...(align === 'end'
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    };
  };

  const openMenu = () => {
    setPos(computePosition());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const firstItem = menuRef.current?.querySelector('button:not(:disabled)');
    firstItem?.focus();

    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerContent ? undefined : label}
        title={triggerContent ? undefined : label}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {triggerContent || <MoreVertical size={18} strokeWidth={2.5} />}
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} className="dropdown-menu" role="menu" aria-label={label} style={pos}>
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`dropdown-menu-item${item.danger ? ' dropdown-menu-item--danger' : ''}`}
              disabled={item.disabled}
              title={item.title}
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              {item.icon && <item.icon size={16} strokeWidth={2.5} />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
