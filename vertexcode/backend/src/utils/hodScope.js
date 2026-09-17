// Shared HOD/STAFF college-scoping helper — used by intern.controller.js and
// trainee.controller.js (listEnrollments), college.controller.js
// (listColleges/getCollege), and analytics.controller.js (hodOverview), so
// every one of these enforces exactly the same authorization boundary. A
// HOD/STAFF account with no collegeId assigned sees nothing — never falls
// back to unrestricted access.
//
// HOD vs STAFF scope width (per the recommended approach): a HOD monitors
// their entire assigned college, all departments — any collegeDepartmentId
// stored on a HOD account is ignored for scoping (also cleared at write
// time in user.controller.js, so this is defense in depth, not the only
// enforcement). A STAFF account is narrowed to its assigned department, if
// one is set.
const HOD_ROLES = ['HOD', 'STAFF'];

function isHodRole(role) {
  return HOD_ROLES.includes(role);
}

// Prisma where-clause fragment (AND array) scoping any collegeId/
// collegeDepartmentId-bearing model (InternEnrollment, TraineeEnrollment)
// to a HOD/STAFF user's authorized college — narrowed to department only
// for STAFF, never for HOD.
function collegeScopeAnd(user) {
  if (!user.collegeId) return [{ id: { in: [] } }];
  const narrowByDept = user.role === 'STAFF' && user.collegeDepartmentId;
  return [
    { collegeId: user.collegeId },
    ...(narrowByDept ? [{ collegeDepartmentId: user.collegeDepartmentId }] : []),
  ];
}

module.exports = { HOD_ROLES, isHodRole, collegeScopeAnd };
