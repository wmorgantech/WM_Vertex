import StatCard from '../../components/common/StatCard';

// Reusable "Expected / Actual / Difference / Working Days" stat cards,
// shared by WeeklyGrid and MonthlySummary so both views present these four
// metrics identically. Thin wrapper over the shared StatCard/.stat-grid —
// same card design used app-wide (standardized to match the Intern
// Documents KpiCard). `tone` (positive/negative/neutral) from callers is no
// longer accepted here; pass `icon`/`accent` per item instead, since the
// shared card conveys meaning via the icon chip's color, not the number's
// text color — see WeeklyGrid.jsx/MonthlySummary.jsx for the accent choices
// that preserve the original green/amber meaning.
export default function SummaryCards({ items }) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} icon={item.icon} accent={item.accent || 'blue'} />
      ))}
    </div>
  );
}
