const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager, isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/project.controller');

router.use(authenticate);

router.get('/', ctrl.listProjects);
router.post('/', isManager, ctrl.createProject);
router.get('/:id', ctrl.getProject);
router.put('/:id', isManager, ctrl.updateProject);
router.delete('/:id', isSuperAdmin, ctrl.deleteProject);
router.post('/:id/members', isManager, ctrl.addMember);
router.delete('/:id/members/:userId', isManager, ctrl.removeMember);

module.exports = router;
