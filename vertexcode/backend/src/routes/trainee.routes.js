const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/trainee.controller');

router.use(authenticate);

router.get('/programs', ctrl.listPrograms);
router.post('/programs', can('trainee', 'manage'), ctrl.createProgram);
router.get('/programs/:id', ctrl.getProgram);
router.put('/programs/:id', can('trainee', 'manage'), ctrl.updateProgram);
router.delete('/programs/:id', isSuperAdmin, ctrl.deleteProgram);

router.get('/topics', ctrl.listTopics);
router.post('/topics', can('trainee', 'manage'), ctrl.createTopic);
router.put('/topics/:id', can('trainee', 'manage'), ctrl.updateTopic);
router.delete('/topics/:id', isSuperAdmin, ctrl.deleteTopic);

router.get('/enrollments', ctrl.listEnrollments);
router.post('/enrollments', can('trainee', 'manage'), ctrl.enrollTrainee);
router.get('/enrollments/:id', ctrl.getEnrollment);
router.put('/enrollments/me', authorize('TRAINEE'), ctrl.updateMyEnrollment);
router.put('/enrollments/:id', can('trainee', 'manage'), ctrl.updateEnrollment);
router.patch('/enrollments/:id/topics/:topicId', can('trainee', 'manage'), ctrl.updateTopicProgress);

router.get('/sessions', ctrl.listSessions);
router.post('/sessions', can('trainee', 'manage'), ctrl.createSession);

router.get('/enrollments/:enrollmentId/payments', ctrl.listPayments);
router.post('/enrollments/:enrollmentId/payments', can('trainee', 'manage'), ctrl.addPayment);

module.exports = router;
