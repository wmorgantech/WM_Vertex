const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/settings.controller');

router.use(authenticate);

router.get('/', ctrl.getSettings);
router.put('/', isSuperAdmin, ctrl.updateSettings);

module.exports = router;
