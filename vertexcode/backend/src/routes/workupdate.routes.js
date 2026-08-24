const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/workupdate.controller');

router.use(authenticate);

router.get('/', ctrl.listWorkUpdates);
router.post('/', ctrl.submitWorkUpdate);
router.patch('/:id/review', can('workupdate', 'review'), ctrl.reviewWorkUpdate);

module.exports = router;
