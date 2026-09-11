import { ShieldCheck, FileText, Download, Award, Tag, Activity, Inbox } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const ACTION_ICONS = {
  FINAL_APPROVED: ShieldCheck,
  OFFER_LETTER_GENERATED: FileText,
  OFFER_LETTER_DOWNLOADED: Download,
  CERTIFICATE_GENERATED: Award,
  CERTIFICATE_DOWNLOADED: Download,
  CATEGORY_SET: Tag,
};

// A compact vertical timeline for the SuperAdmin dashboard's audit log —
// new, not the shared ActivityList (used by 5 other dashboards), so those
// are unaffected. `items` are pre-formatted {id, title, subtitle, meta,
// badgeValue} same as ActivityList expected, with badgeValue being the raw
// audit action code used to pick the icon.
export default function AuditLogTimeline({ items = [], emptyMessage = 'Nothing to show yet.' }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Audit Log</CardTitle>
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
