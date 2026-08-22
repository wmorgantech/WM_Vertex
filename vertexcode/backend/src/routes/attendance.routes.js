const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/attendance.controller');

router.use(authenticate);

router.post('/clock-in', ctrl.clockIn);
router.post('/clock-out', ctrl.clockOut);
router.get('/me', ctrl.myAttendance);
router.get('/summary', ctrl.summary);
router.get('/', isManager, ctrl.listAttendance);
router.post('/mark', isManager, ctrl.markAttendance);

module.exports = router;
