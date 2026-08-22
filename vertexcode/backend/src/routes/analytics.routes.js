const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/analytics.controller');

router.use(authenticate);

router.get('/overview', isManager, ctrl.overview);
router.get('/team', isManager, ctrl.teamPerformance);
router.get('/interns', isManager, ctrl.internPerformance);
router.get('/me', ctrl.myPerformance);

module.exports = router;
