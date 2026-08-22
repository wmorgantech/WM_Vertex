import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Badge from '@/components/shared/Badge';
import { Inbox } from 'lucide-react';

export default function ActivityList({ title, items = [], emptyMessage = 'Nothing to show yet.', viewAllTo, viewAllLabel = 'View all' }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {viewAllTo && items.length > 0 && (
          <Link to={viewAllTo} className="text-xs font-medium text-primary hover:underline">
            {viewAllLabel}
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
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.meta && <span className="text-xs text-muted-foreground">{item.meta}</span>}
                  {item.badgeValue && <Badge value={item.badgeValue} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
