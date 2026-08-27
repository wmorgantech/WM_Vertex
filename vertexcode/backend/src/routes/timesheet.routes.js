const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/timesheet.controller');

router.use(authenticate);

// Static-path routes registered before the /:id-shaped ones below —
// otherwise Express would match e.g. PATCH /bulk/approve as { id: 'bulk' }
// against PATCH /:id/approve. See masters/leave/notification routes for
// the same established pattern.
router.get('/summary', ctrl.getSummary);
router.get('/team-summary', ctrl.getTeamSummary);
router.post('/bulk', ctrl.bulkUpsertTimesheets);
router.post('/submit', ctrl.submitTimesheets);
router.patch('/bulk/approve', can('timesheet', 'approve'), ctrl.bulkApprove);
router.patch('/bulk/reject', can('timesheet', 'reject'), ctrl.bulkReject);

router.get('/', ctrl.listTimesheets);
router.post('/', ctrl.createTimesheet);
router.put('/:id', ctrl.updateTimesheet);
router.patch('/:id/approve', can('timesheet', 'approve'), ctrl.approveTimesheet);
router.patch('/:id/reject', can('timesheet', 'reject'), ctrl.rejectTimesheet);
router.delete('/:id', ctrl.deleteTimesheet);

module.exports = router;
