const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/trainee.controller');

router.use(authenticate);

/**
 * @swagger
 * /trainees/programs:
 *   get:
 *     tags: [Trainees]
 *     summary: List training programs
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
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           name: { type: string }
 *                           description: { type: string, nullable: true }
 *                           technology: { type: string, nullable: true }
 *                           duration: { type: string, nullable: true }
 *                           totalSessions: { type: integer, nullable: true }
 *                           trainerId: { type: string, format: uuid }
 *                           mentorId: { type: string, format: uuid, nullable: true }
 *                           fee: { type: number, nullable: true }
 *                           discount: { type: number, nullable: true }
 *                           finalFee: { type: number, nullable: true }
 *                           startDate: { type: string, format: date }
 *                           endDate: { type: string, format: date }
 *                           status: { type: string, enum: [UPCOMING, ONGOING, COMPLETED, CANCELLED] }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/programs', ctrl.listPrograms);

/**
 * @swagger
 * /trainees/programs:
 *   post:
 *     tags: [Trainees]
 *     summary: Create a training program
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, trainerId, startDate, endDate]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               technology: { type: string }
 *               duration: { type: string }
 *               totalSessions: { type: integer }
 *               trainerId: { type: string, format: uuid }
 *               mentorId: { type: string, format: uuid }
 *               fee: { type: number }
 *               discount: { type: number }
 *               finalFee: { type: number }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               status: { type: string, enum: [UPCOMING, ONGOING, COMPLETED, CANCELLED] }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.post('/programs', can('trainee', 'manage'), ctrl.createProgram);

/**
 * @swagger
 * /trainees/programs/{id}:
 *   get:
 *     tags: [Trainees]
 *     summary: Get a training program by id
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
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Program not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/programs/:id', ctrl.getProgram);

/**
 * @swagger
 * /trainees/programs/{id}:
 *   put:
 *     tags: [Trainees]
 *     summary: Update a training program
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
 *               description: { type: string }
 *               technology: { type: string }
 *               duration: { type: string }
 *               totalSessions: { type: integer }
 *               trainerId: { type: string, format: uuid }
 *               mentorId: { type: string, format: uuid }
 *               fee: { type: number }
 *               discount: { type: number }
 *               finalFee: { type: number }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               status: { type: string, enum: [UPCOMING, ONGOING, COMPLETED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
 *         description: Program not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/programs/:id', can('trainee', 'manage'), ctrl.updateProgram);

/**
 * @swagger
 * /trainees/programs/{id}:
 *   delete:
 *     tags: [Trainees]
 *     summary: Delete a training program
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
 *         description: Program not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: Program has existing enrollments and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/programs/:id', isSuperAdmin, ctrl.deleteProgram);

/**
 * @swagger
 * /trainees/topics:
 *   get:
 *     tags: [Trainees]
 *     summary: List training topics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: programId
 *         in: query
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           programId: { type: string, format: uuid }
 *                           topic: { type: string }
 *                           description: { type: string, nullable: true }
 *                           sequence: { type: integer, nullable: true }
 *                           expectedDurationHours: { type: number, nullable: true }
 *                           trainingMaterial: { type: string, nullable: true }
 *                           active: { type: boolean }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/topics', ctrl.listTopics);

/**
 * @swagger
 * /trainees/topics:
 *   post:
 *     tags: [Trainees]
 *     summary: Create a training topic
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [programId, topic]
 *             properties:
 *               programId: { type: string, format: uuid }
 *               topic: { type: string }
 *               description: { type: string }
 *               sequence: { type: integer }
 *               expectedDurationHours: { type: number }
 *               trainingMaterial: { type: string }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.post('/topics', can('trainee', 'manage'), ctrl.createTopic);

/**
 * @swagger
 * /trainees/topics/{id}:
 *   put:
 *     tags: [Trainees]
 *     summary: Update a training topic
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
 *               topic: { type: string }
 *               description: { type: string }
 *               sequence: { type: integer }
 *               expectedDurationHours: { type: number }
 *               trainingMaterial: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
 *         description: Topic not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/topics/:id', can('trainee', 'manage'), ctrl.updateTopic);

/**
 * @swagger
 * /trainees/topics/{id}:
 *   delete:
 *     tags: [Trainees]
 *     summary: Delete a training topic
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
 *         description: Topic not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/topics/:id', isSuperAdmin, ctrl.deleteTopic);

/**
 * @swagger
 * /trainees/enrollments:
 *   get:
 *     tags: [Trainees]
 *     summary: List trainee enrollments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: programId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: mentorId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: completionStatus
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
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           userId: { type: string, format: uuid }
 *                           programId: { type: string, format: uuid }
 *                           mentorId: { type: string, format: uuid, nullable: true }
 *                           completionStatus: { type: string }
 *                           progressPercent: { type: integer }
 *                           education: { type: string, nullable: true }
 *                           qualification: { type: string, nullable: true }
 *                           experienceYears: { type: number, nullable: true }
 *                           trainingStartDate: { type: string, format: date, nullable: true }
 *                           trainingEndDate: { type: string, format: date, nullable: true }
 *                           totalFee: { type: number, nullable: true }
 *                           discount: { type: number, nullable: true }
 *                           finalFee: { type: number, nullable: true }
 *                           notes: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollments', ctrl.listEnrollments);

/**
 * @swagger
 * /trainees/enrollments:
 *   post:
 *     tags: [Trainees]
 *     summary: Enroll a user as a trainee
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, programId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               programId: { type: string, format: uuid }
 *               mentorId: { type: string, format: uuid }
 *               education: { type: string }
 *               qualification: { type: string }
 *               experienceYears: { type: number }
 *               totalFee: { type: number }
 *               discount: { type: number }
 *               finalFee: { type: number }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.post('/enrollments', can('trainee', 'manage'), ctrl.enrollTrainee);

/**
 * @swagger
 * /trainees/enrollments/{id}:
 *   get:
 *     tags: [Trainees]
 *     summary: Get a trainee enrollment by id
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
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollments/:id', ctrl.getEnrollment);

/**
 * @swagger
 * /trainees/enrollments/me:
 *   put:
 *     tags: [Trainees]
 *     summary: Update the current trainee's own profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               education: { type: string }
 *               qualification: { type: string }
 *               experienceYears: { type: number }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
 *         description: Forbidden — TRAINEE role only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/enrollments/me', authorize('TRAINEE'), ctrl.updateMyEnrollment);

/**
 * @swagger
 * /trainees/enrollments/{id}:
 *   put:
 *     tags: [Trainees]
 *     summary: Update a trainee enrollment
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
 *               completionStatus: { type: string }
 *               progressPercent: { type: integer }
 *               education: { type: string }
 *               qualification: { type: string }
 *               experienceYears: { type: number }
 *               trainingStartDate: { type: string, format: date }
 *               trainingEndDate: { type: string, format: date }
 *               totalFee: { type: number }
 *               discount: { type: number }
 *               finalFee: { type: number }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.put('/enrollments/:id', can('trainee', 'manage'), ctrl.updateEnrollment);

/**
 * @swagger
 * /trainees/enrollments/{id}:
 *   delete:
 *     tags: [Trainees]
 *     summary: Terminate a trainee (soft delete — deactivates the account, keeps the record)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.delete('/enrollments/:id', isSuperAdmin, ctrl.deleteEnrollment);

/**
 * @swagger
 * /trainees/enrollments/{id}/topics/{topicId}:
 *   patch:
 *     tags: [Trainees]
 *     summary: Update a trainee's progress on a topic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: topicId
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
 *               status: { type: string }
 *               assignmentStatus: { type: string }
 *               remarks: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
 *         description: Enrollment or topic not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/enrollments/:id/topics/:topicId', can('trainee', 'manage'), ctrl.updateTopicProgress);

/**
 * @swagger
 * /trainees/sessions:
 *   get:
 *     tags: [Trainees]
 *     summary: List training sessions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: programId
 *         in: query
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           programId: { type: string, format: uuid }
 *                           topicId: { type: string, format: uuid, nullable: true }
 *                           trainerId: { type: string, format: uuid, nullable: true }
 *                           mentorId: { type: string, format: uuid, nullable: true }
 *                           date: { type: string, format: date }
 *                           startTime: { type: string, nullable: true }
 *                           endTime: { type: string, nullable: true }
 *                           topicsCovered: { type: string, nullable: true }
 *                           topicsPending: { type: string, nullable: true }
 *                           trainingMaterial: { type: string, nullable: true }
 *                           remarks: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/sessions', ctrl.listSessions);

/**
 * @swagger
 * /trainees/sessions:
 *   post:
 *     tags: [Trainees]
 *     summary: Create a training session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [programId, date]
 *             properties:
 *               programId: { type: string, format: uuid }
 *               topicId: { type: string, format: uuid }
 *               trainerId: { type: string, format: uuid }
 *               mentorId: { type: string, format: uuid }
 *               date: { type: string, format: date }
 *               startTime: { type: string }
 *               endTime: { type: string }
 *               topicsCovered: { type: string }
 *               topicsPending: { type: string }
 *               trainingMaterial: { type: string }
 *               remarks: { type: string }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.post('/sessions', can('trainee', 'manage'), ctrl.createSession);

/**
 * @swagger
 * /trainees/enrollments/{enrollmentId}/payments:
 *   get:
 *     tags: [Trainees]
 *     summary: List payments for a trainee enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: enrollmentId
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           enrollmentId: { type: string, format: uuid }
 *                           amount: { type: number }
 *                           paymentDate: { type: string, format: date }
 *                           paymentMode: { type: string, nullable: true }
 *                           reference: { type: string, nullable: true }
 *                           notes: { type: string, nullable: true }
 *                           recordedById: { type: string, format: uuid, nullable: true }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Enrollment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollments/:enrollmentId/payments', ctrl.listPayments);

/**
 * @swagger
 * /trainees/enrollments/{enrollmentId}/payments:
 *   post:
 *     tags: [Trainees]
 *     summary: Record a payment for a trainee enrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: enrollmentId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number }
 *               paymentMode: { type: string }
 *               reference: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
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
router.post('/enrollments/:enrollmentId/payments', can('trainee', 'manage'), ctrl.addPayment);

module.exports = router;
