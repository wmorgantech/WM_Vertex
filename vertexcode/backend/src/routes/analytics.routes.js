const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/analytics.controller');

router.use(authenticate);

router.get('/overview', can('analytics', 'view'), ctrl.overview);
router.get('/team', can('analytics', 'view'), ctrl.teamPerformance);
router.get('/interns', can('analytics', 'view'), ctrl.internPerformance);
router.get('/me', ctrl.myPerformance);

module.exports = router;
