const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/timesheet.controller');

router.use(authenticate);

router.get('/', ctrl.listTimesheets);
router.post('/', ctrl.createTimesheet);
router.put('/:id', ctrl.updateTimesheet);
router.patch('/:id/approve', isManager, ctrl.approveTimesheet);
router.patch('/:id/reject', isManager, ctrl.rejectTimesheet);
router.delete('/:id', ctrl.deleteTimesheet);

module.exports = router;
