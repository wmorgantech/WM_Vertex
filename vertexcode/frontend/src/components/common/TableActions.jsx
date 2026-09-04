// Single, shared action-icon treatment for every admin list/table in the
// app (Employees, Interns, Trainees, Departments, ...) — icon size, stroke
// weight, button dimensions, spacing, hover state and tooltip style all
// live here once so every page renders identically. Pass an array of
// action descriptors; falsy entries (e.g. `cond && {...}`) are dropped, so
// callers can conditionally include/exclude actions per-row without extra
// wrapper logic.
export default function TableActions({ actions }) {
  const visible = (actions || []).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="table-actions">
      {visible.map(({ key, icon: Icon, label, onClick, danger, disabled }) => (
        <button
          key={key}
          type="button"
          className={`table-action-btn${danger ? ' table-action-btn--danger' : ''}`}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
        >
          <Icon size={18} strokeWidth={2.5} />
        </button>
      ))}
    </div>
  );
}
