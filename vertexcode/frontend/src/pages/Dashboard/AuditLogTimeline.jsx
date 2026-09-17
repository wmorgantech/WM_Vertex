import { Link } from 'react-router-dom';
import {
  ShieldCheck, FileText, Download, Award, Tag, Activity, Inbox, FilePlus, Pencil, Trash2,
  RotateCcw, CheckCircle2, XCircle, Upload, Send, RefreshCw, ArrowRightLeft, UserX,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Covers every action string actually written to the AuditLog table across
// the backend (verified via grep of every `recordAudit({ action: ... })`
// call site) plus the narrower InternshipAudit-specific ones this
// component originally supported — a sensible fallback (Activity) covers
// anything not explicitly listed rather than rendering nothing.
const ACTION_ICONS = {
  CREATED: FilePlus,
  UPDATED: Pencil,
  EDITED: Pencil,
  DELETED: Trash2,
  PERMANENTLY_DELETED: Trash2,
  RESTORED: RotateCcw,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  EXPORTED: Download,
  IMPORTED: Upload,
  SUBMITTED: Send,
  RESUBMITTED: Send,
  UPLOADED: Upload,
  DOCUMENT_UPLOADED: Upload,
  DOWNLOADED: Download,
  STATUS_CHANGED: RefreshCw,
  REASSIGNED: ArrowRightLeft,
  DEACTIVATED: UserX,
  FINAL_APPROVED: ShieldCheck,
  OFFER_LETTER_GENERATED: FileText,
  OFFER_LETTER_DOWNLOADED: Download,
  CERTIFICATE_GENERATED: Award,
  CERTIFICATE_DOWNLOADED: Download,
  CATEGORY_SET: Tag,
};

// A compact vertical timeline for the SuperAdmin dashboard — new, not the
// shared ActivityList (used by 5 other dashboards), so those are
// unaffected. `items` are pre-formatted {id, title, subtitle, meta,
// badgeValue} same as ActivityList expected, with badgeValue being the raw
// audit action code used to pick the icon.
export default function AuditLogTimeline({ items = [], emptyMessage = 'Nothing to show yet.', title = 'Recent Activity', viewAllTo }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {viewAllTo && items.length > 0 && (
          <Link to={viewAllTo} className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="pb-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="size-5 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ul>
            {items.map((item, idx) => {
              const Icon = ACTION_ICONS[item.badgeValue] || Activity;
              const isLast = idx === items.length - 1;
              return (
                <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-border"
                    />
                  )}
                  <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                    {item.meta && <p className="mt-0.5 text-xs text-muted-foreground/70">{item.meta}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
