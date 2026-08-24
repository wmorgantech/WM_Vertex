const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/leave.controller');

router.use(authenticate);

router.get('/', ctrl.listRequests);
router.post('/', ctrl.createRequest);
router.delete('/:id', ctrl.cancelRequest);
router.patch('/:id/approve', can('leave', 'approve'), ctrl.approveRequest);
router.patch('/:id/reject', can('leave', 'approve'), ctrl.rejectRequest);

module.exports = router;
