const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isManager } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/document.controller');

router.use(authenticate);

router.get('/mine', authorize('INTERN'), ctrl.getMine);
router.post('/upload', authorize('INTERN'), upload.single('file'), ctrl.uploadDocument);
router.post('/submit', authorize('INTERN'), ctrl.submitForVerification);

router.get('/', isManager, ctrl.listAll);
router.get('/enrollment/:enrollmentId', isManager, ctrl.getEnrollmentDetail);
router.patch('/:id/approve', isManager, ctrl.approve);
router.patch('/:id/reject', isManager, ctrl.reject);

router.get('/:id/download', ctrl.download);

module.exports = router;
