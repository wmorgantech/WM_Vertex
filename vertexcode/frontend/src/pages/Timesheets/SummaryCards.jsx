// Reusable "Expected / Actual / Difference / Working Days" stat cards,
// shared by WeeklyGrid and MonthlySummary so both views present these four
// metrics identically. Deliberately not the shared StatCard/.stat-grid
// (those stay untouched for every other page in the app, and carry a
// heavier accent-stripe/icon-well treatment this summary doesn't want) —
// a small, purpose-built card scoped to Timesheets.
export default function SummaryCards({ items }) {
  return (
    <div className="ts-stat-grid">
      {items.map((item) => (
        <div className="ts-stat-card" key={item.label}>
          <span className={`ts-stat-value${item.tone ? ` ts-stat-${item.tone}` : ''}`}>{item.value}</span>
          <span className="ts-stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
