const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/workupdate.controller');

router.use(authenticate);

router.get('/', ctrl.listWorkUpdates);
router.post('/', ctrl.submitWorkUpdate);
router.patch('/:id/review', isManager, ctrl.reviewWorkUpdate);

module.exports = router;
