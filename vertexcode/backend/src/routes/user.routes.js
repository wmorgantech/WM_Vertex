const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager, isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/user.controller');

router.use(authenticate);

router.get('/', isManager, ctrl.listUsers);
router.post('/', isManager, ctrl.createUser);
router.get('/:id/org-chart', ctrl.orgChart);
router.get('/:id', ctrl.getUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', isSuperAdmin, ctrl.deactivateUser);

module.exports = router;
