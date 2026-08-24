const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/search.controller');

router.use(authenticate, isManager);

router.get('/', ctrl.search);

module.exports = router;
