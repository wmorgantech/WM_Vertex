const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/permission.controller');

router.use(authenticate, isSuperAdmin);

router.get('/', ctrl.listPermissions);
router.put('/', ctrl.updatePermissions);

module.exports = router;
