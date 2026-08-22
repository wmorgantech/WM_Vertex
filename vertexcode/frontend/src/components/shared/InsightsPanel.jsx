import { Sparkles, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  warning: { icon: AlertTriangle, className: 'bg-warning/15 text-warning-foreground dark:text-warning' },
  info: { icon: Info, className: 'bg-info/15 text-info' },
  success: { icon: CheckCircle2, className: 'bg-success/15 text-success' },
};

export default function InsightsPanel({ insights = [], title = 'Insights' }) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {insights.map((insight, idx) => {
          const tone = TONE_STYLES[insight.tone] || TONE_STYLES.info;
          const Icon = tone.icon;
          return (
            <div key={idx} className="flex items-start gap-3">
              <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md', tone.className)}>
                <Icon className="size-3.5" />
              </span>
              <p className="text-sm leading-snug text-foreground/90">{insight.text}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
