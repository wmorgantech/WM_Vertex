const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/document.controller');

router.use(authenticate);

router.get('/mine', authorize('INTERN'), ctrl.getMine);
router.post('/upload', authorize('INTERN'), upload.single('file'), ctrl.uploadDocument);
router.post('/submit', authorize('INTERN'), ctrl.submitForVerification);

router.get('/', can('document', 'view'), ctrl.listAll);
router.get('/enrollment/:enrollmentId', can('document', 'view'), ctrl.getEnrollmentDetail);
router.patch('/:id/approve', can('document', 'approve'), ctrl.approve);
router.patch('/:id/reject', can('document', 'reject'), ctrl.reject);

router.get('/:id/download', ctrl.download);

module.exports = router;
