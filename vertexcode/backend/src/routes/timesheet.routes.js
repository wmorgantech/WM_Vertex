const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/timesheet.controller');

router.use(authenticate);

router.get('/', ctrl.listTimesheets);
router.post('/', ctrl.createTimesheet);
router.put('/:id', ctrl.updateTimesheet);
router.patch('/:id/approve', can('timesheet', 'approve'), ctrl.approveTimesheet);
router.patch('/:id/reject', can('timesheet', 'reject'), ctrl.rejectTimesheet);
router.delete('/:id', ctrl.deleteTimesheet);

module.exports = router;
