const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
