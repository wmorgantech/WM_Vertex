const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/department.controller');

router.use(authenticate);

router.get('/', ctrl.listDepartments);
router.get('/:id', ctrl.getDepartment);
router.post('/', can('department', 'create'), ctrl.createDepartment);
router.put('/:id', can('department', 'edit'), ctrl.updateDepartment);
router.delete('/:id', isSuperAdmin, ctrl.deleteDepartment);

module.exports = router;
