const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/college.controller');

router.use(authenticate);

router.get('/', can('mou', 'manage'), ctrl.listMous);
router.post('/', can('mou', 'manage'), ctrl.createMou);
router.get('/:id', can('mou', 'manage'), ctrl.getMou);
router.put('/:id', can('mou', 'manage'), ctrl.updateMou);
router.delete('/:id', isSuperAdmin, ctrl.deleteMou);

module.exports = router;
