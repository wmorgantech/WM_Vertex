const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/enquiry.controller');

router.use(authenticate);

router.get('/', ctrl.listEnquiries);
// Open to any staff role — interns/trainees excluded, everyone else may log
// an enquiry they've taken (e.g. an inbound call). See enquiry.controller.js.
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), ctrl.createEnquiry);
router.get('/:id', ctrl.getEnquiry);
// No route-level gate on update — the assigned employee may update their own
// enquiry's status/notes even without a manager role; the controller checks
// manager-or-assignee.
router.put('/:id', ctrl.updateEnquiry);
router.delete('/:id', isSuperAdmin, ctrl.deleteEnquiry);

module.exports = router;
