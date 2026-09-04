// One label/value block for the shared read-only "View" card layout
// (.detail-card / .detail-grid in index.css) — used identically across
// every module's View modal (Employees, Interns, Trainees, Departments).
export default function DetailField({ icon: Icon, label, value, full }) {
  return (
    <div className={`detail-field${full ? ' detail-field-full' : ''}`}>
      {Icon && <Icon size={14} className="detail-field-icon" />}
      <div>
        <p className="detail-field-label">{label}</p>
        <p className="detail-field-value">{value ?? '—'}</p>
      </div>
    </div>
  );
}
