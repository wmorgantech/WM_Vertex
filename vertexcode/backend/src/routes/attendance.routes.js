const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/attendance.controller');

router.use(authenticate);

router.post('/clock-in', ctrl.clockIn);
router.post('/clock-out', ctrl.clockOut);
router.get('/me', ctrl.myAttendance);
router.get('/summary', ctrl.summary);
router.get('/', can('attendance', 'view'), ctrl.listAttendance);
router.post('/mark', can('attendance', 'mark'), ctrl.markAttendance);

module.exports = router;
