const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/auditLog.controller');

router.use(authenticate, isSuperAdmin);

router.get('/', ctrl.listAuditLogs);

module.exports = router;
