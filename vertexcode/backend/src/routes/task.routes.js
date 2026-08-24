const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/task.controller');

router.use(authenticate);

router.get('/', ctrl.listTasks);
router.post('/', can('task', 'create'), ctrl.createTask);
router.get('/:id', ctrl.getTask);
router.put('/:id', ctrl.updateTask);
router.delete('/:id', isSuperAdmin, ctrl.deleteTask);

module.exports = router;
