const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin, isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/customField.controller');

router.use(authenticate);

// Static paths (/all, /values) must be registered before the /:id param
// route below, or Express matches them as { id: "values" } etc. instead.
router.get('/all', isSuperAdmin, ctrl.listAllDefinitions);

// Values attach to records (employees, interns, colleges...) that only
// managers can otherwise edit, so setting them is manager-only too.
router.get('/values', ctrl.getValues);
router.put('/values', isManager, ctrl.setValues);

// Reads are open to any authenticated user — a form needs to know which
// custom fields to render. Definition management is Super Admin only.
router.get('/', ctrl.listDefinitions);
router.post('/', isSuperAdmin, ctrl.createDefinition);
router.put('/:id', isSuperAdmin, ctrl.updateDefinition);
router.delete('/:id', isSuperAdmin, ctrl.deleteDefinition);

module.exports = router;
