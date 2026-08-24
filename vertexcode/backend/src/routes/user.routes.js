const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/user.controller');

router.use(authenticate);

router.get('/', can('user', 'view'), ctrl.listUsers);
router.post('/', can('user', 'create'), ctrl.createUser);
router.get('/:id/org-chart', ctrl.orgChart);
router.get('/:id', ctrl.getUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', isSuperAdmin, ctrl.deactivateUser);

module.exports = router;
