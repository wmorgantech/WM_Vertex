export default function StatCard({ label, value, hint, accent = 'blue', icon: Icon }) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-card-top">
        <div className="stat-label">{label}</div>
        {Icon && (
          <span className="stat-icon">
            <Icon />
          </span>
        )}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}
