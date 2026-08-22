import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ACCENTS = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  purple: 'bg-purple/15 text-purple',
  info: 'bg-info/15 text-info',
  muted: 'bg-muted text-muted-foreground',
};

export default function KpiCard({ label, value, hint, icon: Icon, accent = 'primary', className }) {
  return (
    <Card className={cn('gap-3 p-5', className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', ACCENTS[accent] || ACCENTS.primary)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
