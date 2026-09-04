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

/**
 * @swagger
 * /interns:
 *   post:
 *     tags: [Interns]
 *     summary: Create an intern profile
 *     description: >
 *       Creates a new intern profile (a User with role=INTERN) only — this
 *       does NOT enroll the intern in a batch. Enrollment is a separate,
 *       later step (see POST /interns/enrollments).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               designation: { type: string }
 *               departmentId: { type: string, format: uuid }
 *               managerId: { type: string, format: uuid }
 *               locationId: { type: string, format: uuid }
 *               joinDate: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: A user with this email already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', canAddIntern, ctrl.createIntern);

/**
 * @swagger
 * /interns/batches:
 *   get:
 *     tags: [Interns]
 *     summary: List internship batches
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/InternshipBatch' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/batches', ctrl.listBatches);

/**
 * @swagger
 * /interns/batches:
 *   post:
 *     tags: [Interns]
 *     summary: Create an internship batch
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, program, startDate, endDate]
 *             properties:
 *               name: { type: string }
 *               program: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               description: { type: string }
 *               status: { type: string, enum: [UPCOMING, ONGOING, COMPLETED, CANCELLED] }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/InternshipBatch' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/batches', can('intern', 'manage'), ctrl.createBatch);

/**
 * @swagger
 * /interns/batches/{id}:
 *   get:
 *     tags: [Interns]
 *     summary: Get an internship batch by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/InternshipBatch'
 *                         - type: object
 *                           description: Includes enrollments
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Batch not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/batches/:id', ctrl.getBatch);

/**
 * @swagger
 * /interns/batches/{id}:
 *   put:
 *     tags: [Interns]
 *     summary: Update an internship batch
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               program: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               description: { type: string }
 *               status: { type: string, enum: [UPCOMING, ONGOING, COMPLETED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/InternshipBatch' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Batch not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/batches/:id', can('intern', 'manage'), ctrl.updateBatch);

/**
 * @swagger
 * /interns/batches/{id}:
 *   delete:
 *     tags: [Interns]
 *     summary: Delete an internship batch
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — Super Admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Batch not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: Batch has existing enrollments and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/batches/:id', isSuperAdmin, ctrl.deleteBatch);

/**
 * @swagger
 * /interns/enrollments:
 *   get:
 *     tags: [Interns]
 *     summary: List intern enrollments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: batchId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: mentorId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: completionStatus
 *         in: query
 *         schema: { type: string, enum: [IN_PROGRESS, COMPLETED, TERMINATED, EXTENDED, CONVERTED_TO_EMPLOYEE] }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/InternEnrollment'
 *                           - type: object
 *                             description: Includes user, batch, and mentor
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollments', ctrl.listEnrollments);

/**
 * @swagger
 * /interns/enrollable-users:
 *   get:
 *     tags: [Interns]
 *     summary: List intern profiles eligible to be enrolled in a batch
 *     description: Returns users with role=INTERN that are not yet enrolled in a batch.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollable-users', canAddIntern, ctrl.listEnrollableUsers);

/**
 * @swagger
 * /interns/enrollments:
 *   post:
 *     tags: [Interns]
 *     summary: Enroll an existing intern into a batch
 *     description: >
 *       The target user must already have an intern profile (role=INTERN —
 *       see POST /interns) and must not already be enrolled in a batch.
 *       This never creates or modifies a User row.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, batchId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               batchId: { type: string, format: uuid }
 *               mentorId: { type: string, format: uuid }
 *               stipend: { type: number }
 *               notes: { type: string }
 *               category: { type: string, enum: [FREE_INTERNSHIP, JOT] }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/InternEnrollment' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: User or batch not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: This intern is already enrolled in a batch
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/enrollments', canAddIntern, ctrl.enrollIntern);

/**
 * @swagger
 * /interns/enrollments/me:
 *   put:
 *     tags: [Interns]
 *     summary: Update the current intern's own academic profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               collegeName: { type: string }
 *               university: { type: string }
 *               collegeDepartment: { type: string }
 *               course: { type: string }
 *               branch: { type: string }
 *               year: { type: string }
 *               semester: { type: string }
 *               registerNumber: { type: string }
 *               collegeEmail: { type: string, format: email }
 *               hodName: { type: string }
 *               internshipStartDate: { type: string, format: date }
 *               internshipEndDate: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/InternEnrollment' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — INTERN role only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/enrollments/me', authorize('INTERN'), ctrl.updateMyEnrollment);

/**
 * @swagger
 * /interns/enrollments/{id}:
 *   put:
 *     tags: [Interns]
 *     summary: Update an intern enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mentorId: { type: string, format: uuid }
 *               completionStatus: { type: string, enum: [IN_PROGRESS, COMPLETED, TERMINATED, EXTENDED, CONVERTED_TO_EMPLOYEE] }
 *               performanceRating: { type: number }
 *               progressPercent: { type: integer }
 *               stipend: { type: number }
 *               notes: { type: string }
 *               category: { type: string, enum: [FREE_INTERNSHIP, JOT] }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/InternEnrollment' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/enrollments/:id', can('intern', 'manage'), ctrl.updateEnrollment);

/**
 * @swagger
 * /interns/enrollments/{id}:
 *   delete:
 *     tags: [Interns]
 *     summary: Soft-delete (terminate) an intern enrollment
 *     description: >
 *       Terminates the enrollment and deactivates the associated user. Soft
 *       delete only — no rows are removed. Gated the same as editing an
 *       enrollment (intern:manage), so Super Admin and any Admin holding
 *       that permission can both perform it.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — requires the intern:manage permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
// Same gate as PUT /enrollments/:id (updateEnrollment) — this is a soft
// delete (completionStatus -> TERMINATED, user.status -> TERMINATED, see
// deleteEnrollment), functionally an update despite the DELETE verb, so it
// belongs behind the same intern:manage permission as every other
// enrollment-management action rather than the hardcoded Super-Admin-only
// gate used for genuine hard deletes (e.g. deleteBatch below).
router.delete('/enrollments/:id', can('intern', 'manage'), ctrl.deleteEnrollment);

/**
 * @swagger
 * /interns/enrollments/{id}/approve:
 *   post:
 *     tags: [Interns]
 *     summary: Final-approve an intern enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/InternEnrollment' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — Super Admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/enrollments/:id/approve', isSuperAdmin, ctrl.finalApprove);

/**
 * @swagger
 * /interns/enrollments/{id}/offer-letter:
 *   post:
 *     tags: [Interns]
 *     summary: Generate an offer letter PDF for an intern enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Offer letter generated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       description: Offer letter metadata
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — Super Admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/enrollments/:id/offer-letter', isSuperAdmin, ctrl.generateOfferLetter);

/**
 * @swagger
 * /interns/enrollments/{id}/offer-letter/download:
 *   get:
 *     tags: [Interns]
 *     summary: Download the generated offer letter PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Offer letter not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollments/:id/offer-letter/download', ctrl.downloadOfferLetter);

/**
 * @swagger
 * /interns/enrollments/{id}/certificate:
 *   post:
 *     tags: [Interns]
 *     summary: Generate a completion certificate PDF for an intern enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Certificate generated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       description: Certificate metadata
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — Super Admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/enrollments/:id/certificate', isSuperAdmin, ctrl.generateCertificate);

/**
 * @swagger
 * /interns/enrollments/{id}/certificate/download:
 *   get:
 *     tags: [Interns]
 *     summary: Download the generated completion certificate PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Certificate not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollments/:id/certificate/download', ctrl.downloadCertificate);

module.exports = router;
