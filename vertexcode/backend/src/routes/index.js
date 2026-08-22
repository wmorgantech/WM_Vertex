const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/departments', require('./department.routes'));
router.use('/interns', require('./intern.routes'));
router.use('/documents', require('./document.routes'));
router.use('/projects', require('./project.routes'));
router.use('/tasks', require('./task.routes'));
router.use('/attendance', require('./attendance.routes'));
router.use('/timesheets', require('./timesheet.routes'));
router.use('/work-updates', require('./workupdate.routes'));
router.use('/analytics', require('./analytics.routes'));

module.exports = router;
