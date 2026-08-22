import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function QuickActions({ actions = [], title = 'Quick Actions' }) {
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pb-5">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <action.icon className="size-4" />
            </span>
            <span className="flex-1 font-medium text-foreground">{action.label}</span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
