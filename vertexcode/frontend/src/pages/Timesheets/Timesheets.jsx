import { useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import { downloadReport } from '../../lib/download';
import WeeklyGrid from './WeeklyGrid';
import MonthlySummary from './MonthlySummary';
import TeamView from './TeamView';

export default function Timesheets() {
  const { user } = useAuth();
  const isManager = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const [scope, setScope] = useState(isManager ? 'team' : 'mine'); // 'mine' | 'team'
  const [view, setView] = useState('weekly'); // 'weekly' | 'monthly' | 'calendar'
  // Set only when Monthly's "View" jumps to a specific week — cleared when
  // the Weekly tab is clicked directly, so that always lands on the
  // current week as before.
  const [weekJump, setWeekJump] = useState(null);

  const goToWeekly = () => { setView('weekly'); setWeekJump(null); };
  const viewWeek = (monday) => { setWeekJump(monday); setView('weekly'); };
  return (
    <div className={`timesheets-page timesheet-view-${scope === 'team' ? 'team' : view}`}>
      <PageHeader
        title={scope === 'team' ? 'Team Timesheets' : `${view === 'weekly' ? 'Weekly' : view === 'monthly' ? 'Monthly' : 'Calendar'} Timesheet`}
        subtitle={scope === 'team' ? 'Review and approve team timesheets' : 'Log your working hours and track approval status'}
        actions={(
          <>
            {scope === 'mine' && (
              <div className="ts-segment ts-view-segment" aria-label="Timesheet view">
                <button className={view === 'weekly' ? 'active' : ''} onClick={goToWeekly}>Weekly</button>
                <button className={view === 'monthly' ? 'active' : ''} onClick={() => setView('monthly')}>Monthly</button>
                <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={14} /> Calendar</button>
              </div>
            )}
            {user.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/timesheets', 'timesheets.csv')}><Download size={16} strokeWidth={2.5} /> Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/timesheets?format=xlsx', 'timesheets.xlsx')}><Download size={16} strokeWidth={2.5} /> Export Excel</button>
              </>
            )}
          </>
        )}
      />

      <div className="timesheet-toolbar">
        <div className="ts-role-tabs" aria-label="Timesheet module">
          {!isManager && <span className="ts-my-timesheet-label">My Timesheet</span>}
        </div>
        {isManager && (
          <div className="ts-scope-tabs" aria-label="Timesheet scope">
            <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>My Timesheet</button>
            <button className={scope === 'team' ? 'active' : ''} onClick={() => setScope('team')}>Team</button>
          </div>
        )}
      </div>

      {scope === 'mine' ? (
        view === 'weekly' ? <WeeklyGrid initialMonday={weekJump} />
          : <MonthlySummary onViewWeek={viewWeek} calendarOnly={view === 'calendar'} />
      ) : (
        <TeamView />
      )}
    </div>
  );
}
