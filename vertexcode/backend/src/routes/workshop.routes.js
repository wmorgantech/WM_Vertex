const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/college.controller');

router.use(authenticate);

router.get('/', ctrl.listWorkshops);
router.post('/', can('workshop', 'manage'), ctrl.createWorkshop);
router.get('/:id', ctrl.getWorkshop);
// No route-level gate on update — the assigned employee may update their own
// workshop's status/notes even without the broader "manage" permission; the
// controller checks manager-or-assignee.
router.put('/:id', ctrl.updateWorkshop);
router.delete('/:id', isSuperAdmin, ctrl.deleteWorkshop);

module.exports = router;
