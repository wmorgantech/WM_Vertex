const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ApiError = require('../utils/apiError');
const ctrl = require('../controllers/intern.controller');

// Business rule: Super Admin and (permission-checked) Admin can always add
// interns; additionally, any Employee holding the "Senior Full Stack
// Developer" designation may add interns even without the broader
// intern-management permission. This is deliberately narrower than
// can('intern','manage') — it only covers adding, not editing or deleting.
const SENIOR_FULLSTACK_DESIGNATION = 'Senior Full Stack Developer';
function canAddIntern(req, res, next) {
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    return can('intern', 'manage')(req, res, next);
  }
  if (req.user.designation === SENIOR_FULLSTACK_DESIGNATION) return next();
  return next(new ApiError(403, 'You do not have permission to add interns'));
}

router.use(authenticate);

router.get('/batches', ctrl.listBatches);
router.post('/batches', can('intern', 'manage'), ctrl.createBatch);
router.get('/batches/:id', ctrl.getBatch);
router.put('/batches/:id', can('intern', 'manage'), ctrl.updateBatch);
router.delete('/batches/:id', isSuperAdmin, ctrl.deleteBatch);

router.get('/enrollments', ctrl.listEnrollments);
router.get('/enrollable-users', canAddIntern, ctrl.listEnrollableUsers);
router.post('/enrollments', canAddIntern, ctrl.enrollIntern);
router.put('/enrollments/me', authorize('INTERN'), ctrl.updateMyEnrollment);
router.put('/enrollments/:id', can('intern', 'manage'), ctrl.updateEnrollment);
router.delete('/enrollments/:id', isSuperAdmin, ctrl.deleteEnrollment);

router.post('/enrollments/:id/approve', isSuperAdmin, ctrl.finalApprove);
router.post('/enrollments/:id/offer-letter', isSuperAdmin, ctrl.generateOfferLetter);
router.get('/enrollments/:id/offer-letter/download', ctrl.downloadOfferLetter);
router.post('/enrollments/:id/certificate', isSuperAdmin, ctrl.generateCertificate);
router.get('/enrollments/:id/certificate/download', ctrl.downloadCertificate);

module.exports = router;
