import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import { downloadReport } from '../../lib/download';
import WeeklyGrid from './WeeklyGrid';
import MonthlySummary from './MonthlySummary';
import TeamView from './TeamView';

export default function Timesheets() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [scope, setScope] = useState('mine'); // 'mine' | 'team'
  const [view, setView] = useState('weekly'); // 'weekly' | 'monthly'
  // Set only when Monthly's "View" jumps to a specific week — cleared when
  // the Weekly tab is clicked directly, so that always lands on the
  // current week as before.
  const [weekJump, setWeekJump] = useState(null);

  const goToWeekly = () => { setView('weekly'); setWeekJump(null); };
  const viewWeek = (monday) => { setWeekJump(monday); setView('weekly'); };

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Log your working hours and track approval status"
        actions={(
          <>
            {scope === 'mine' && (
              <div className="ts-segment">
                <button className={view === 'weekly' ? 'active' : ''} onClick={goToWeekly}>Weekly</button>
                <button className={view === 'monthly' ? 'active' : ''} onClick={() => setView('monthly')}>Monthly</button>
              </div>
            )}
            {user.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/timesheets', 'timesheets.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/timesheets?format=xlsx', 'timesheets.xlsx')}>Export Excel</button>
              </>
            )}
          </>
        )}
      />

      {/* A tab bar with a single, always-active item is chrome with nothing to
          switch between — only managers (who also have Team) see it. */}
      {isManager && (
        <div className="tabs">
          <button className={`tab ${scope === 'mine' ? 'active' : ''}`} onClick={() => setScope('mine')}>My Timesheet</button>
          <button className={`tab ${scope === 'team' ? 'active' : ''}`} onClick={() => setScope('team')}>Team</button>
        </div>
      )}

      {scope === 'mine' ? (
        view === 'weekly' ? <WeeklyGrid initialMonday={weekJump} /> : <MonthlySummary onViewWeek={viewWeek} />
      ) : (
        <TeamView />
      )}
    </div>
  );
}
