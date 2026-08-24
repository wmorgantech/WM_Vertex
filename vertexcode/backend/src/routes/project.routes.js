const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/project.controller');

router.use(authenticate);

router.get('/', ctrl.listProjects);
router.post('/', can('project', 'create'), ctrl.createProject);
router.get('/:id', ctrl.getProject);
router.put('/:id', can('project', 'edit'), ctrl.updateProject);
router.delete('/:id', isSuperAdmin, ctrl.deleteProject);
router.post('/:id/members', can('project', 'assign'), ctrl.addMember);
router.delete('/:id/members/:userId', can('project', 'assign'), ctrl.removeMember);

module.exports = router;
