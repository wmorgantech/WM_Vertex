const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/report.controller');

// Export is deliberately hard-restricted to Super Admin — not routed through
// the configurable Admin permission matrix, per explicit business rule
// ("only Super Admin can export the reports"). Admins cannot be granted this
// even by toggling a permission.
router.use(authenticate, isSuperAdmin);

router.get('/employees', ctrl.exportEmployees);
router.get('/attendance', ctrl.exportAttendance);
router.get('/timesheets', ctrl.exportTimesheets);
router.get('/tasks', ctrl.exportTasks);
router.get('/interns', ctrl.exportInterns);
router.get('/trainees', ctrl.exportTrainees);
router.get('/expenses', ctrl.exportExpenses);

module.exports = router;
