const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/expense.controller');

router.use(authenticate);

// Financial data — gated by the configurable Admin permission matrix like
// other transactional modules; SUPER_ADMIN always passes. Delete is
// hard-restricted to Super Admin, matching every other module's pattern.
router.get('/summary', can('expense', 'view'), ctrl.summary);
router.get('/', can('expense', 'view'), ctrl.list);
router.post('/', can('expense', 'create'), ctrl.create);
router.put('/:id', can('expense', 'edit'), ctrl.update);
router.delete('/:id', isSuperAdmin, ctrl.remove);

module.exports = router;
