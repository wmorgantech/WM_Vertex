const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager, isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/department.controller');

router.use(authenticate);

router.get('/', ctrl.listDepartments);
router.get('/:id', ctrl.getDepartment);
router.post('/', isManager, ctrl.createDepartment);
router.put('/:id', isManager, ctrl.updateDepartment);
router.delete('/:id', isSuperAdmin, ctrl.deleteDepartment);

module.exports = router;
