// Human-friendly display ID for the UI, since the real primary key is a
// UUID. Derived entirely from Joining Date (WMCBE + 2-digit year + 2-digit
// month) rather than stored, so it always reflects the current joinDate —
// creating or updating a profile with a new Joining Date changes this on
// the very next read, with nothing to keep in sync.
//
// Shared by user.controller.js (Employees) and intern.controller.js
// (Interns) — every User row gets the same code convention regardless of
// role, since an intern is just a User with role=INTERN.
function computeEmployeeCode(joinDate) {
  const d = new Date(joinDate);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `WMCBE${yy}${mm}`;
}

module.exports = { computeEmployeeCode };
