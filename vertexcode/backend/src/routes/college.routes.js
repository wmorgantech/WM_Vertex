const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/college.controller');

router.use(authenticate);

router.get('/', ctrl.listColleges);
router.post('/', can('college', 'manage'), ctrl.createCollege);
router.get('/:id', ctrl.getCollege);
router.put('/:id', can('college', 'manage'), ctrl.updateCollege);
router.delete('/:id', isSuperAdmin, ctrl.deleteCollege);

router.post('/departments', can('college', 'manage'), ctrl.createCollegeDepartment);
router.put('/departments/:id', can('college', 'manage'), ctrl.updateCollegeDepartment);
router.delete('/departments/:id', can('college', 'manage'), ctrl.deleteCollegeDepartment);

module.exports = router;
