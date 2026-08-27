import { useEffect, useState } from 'react';
import { FileClock } from 'lucide-react';
import api from '@/api/axios';
import { Card, CardContent } from '@/components/ui/card';
import Badge from '@/components/shared/Badge';
import { mondayOf, addDays, toIsoDate, formatWeekRange, TIMESHEET_STATUS_LABELS } from '@/pages/Timesheets/weekUtils';

// Current-week Timesheet status, shown on the Employee/Intern/Trainee
// dashboards (Draft/Waiting for Approval/Approved/Rejected) — reuses the
// same /timesheets/summary endpoint and Badge status colors as the
// Timesheets page itself, just a compact read-only glance.
export default function TimesheetStatusCard() {
  const [status, setStatus] = useState(null);
  const monday = mondayOf(new Date());

  useEffect(() => {
    const from = toIsoDate(monday);
    const to = toIsoDate(addDays(monday, 6));
    api.get('/timesheets/summary', { params: { from, to } })
      .then(({ data }) => setStatus(data.data.status))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileClock className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Timesheet</p>
            <p className="text-xs text-muted-foreground">{formatWeekRange(monday, 6)}</p>
          </div>
        </div>
        {status && <Badge value={status} label={TIMESHEET_STATUS_LABELS[status]} />}
      </CardContent>
    </Card>
  );
}
