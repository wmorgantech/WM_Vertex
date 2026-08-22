const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isManager, isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/intern.controller');

router.use(authenticate);

router.get('/batches', ctrl.listBatches);
router.post('/batches', isManager, ctrl.createBatch);
router.get('/batches/:id', ctrl.getBatch);
router.put('/batches/:id', isManager, ctrl.updateBatch);
router.delete('/batches/:id', isSuperAdmin, ctrl.deleteBatch);

router.get('/enrollments', ctrl.listEnrollments);
router.post('/enrollments', isManager, ctrl.enrollIntern);
router.put('/enrollments/me', authorize('INTERN'), ctrl.updateMyEnrollment);
router.put('/enrollments/:id', isManager, ctrl.updateEnrollment);

router.post('/enrollments/:id/approve', isSuperAdmin, ctrl.finalApprove);
router.post('/enrollments/:id/offer-letter', isSuperAdmin, ctrl.generateOfferLetter);
router.get('/enrollments/:id/offer-letter/download', ctrl.downloadOfferLetter);
router.post('/enrollments/:id/certificate', isSuperAdmin, ctrl.generateCertificate);
router.get('/enrollments/:id/certificate/download', ctrl.downloadCertificate);

module.exports = router;
