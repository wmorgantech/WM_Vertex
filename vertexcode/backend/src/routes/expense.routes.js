const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/expense.controller');

router.use(authenticate);

// Financial data — hard-restricted to Super Admin only (business rule, not
// routed through the configurable Admin permission matrix like other
// transactional modules). Admin cannot be granted this even by toggling a
// permission — see Permissions.jsx, which no longer exposes an Expense row.
router.get('/summary', isSuperAdmin, ctrl.summary);
router.get('/', isSuperAdmin, ctrl.list);
router.post('/', isSuperAdmin, ctrl.create);
router.put('/:id', isSuperAdmin, ctrl.update);
router.delete('/:id', isSuperAdmin, ctrl.remove);

module.exports = router;
