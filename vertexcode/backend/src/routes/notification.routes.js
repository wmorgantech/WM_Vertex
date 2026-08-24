const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', ctrl.listMine);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

// Configurable by Super Admin only, matching the "Notifications should be
// configurable by Admin/Super Admin" spec via the same lever Super Admin
// already uses for everything else app-wide (Admin's own scope stays what
// Super Admin has granted it through the Permission matrix elsewhere).
router.get('/settings', isSuperAdmin, ctrl.listSettings);
router.put('/settings', isSuperAdmin, ctrl.updateSettings);

module.exports = router;
