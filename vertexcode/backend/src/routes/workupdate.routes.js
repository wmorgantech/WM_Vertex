const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/workupdate.controller');

router.use(authenticate);

/**
 * @swagger
 * /work-updates:
 *   get:
 *     tags: [WorkUpdates]
 *     summary: List daily work updates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [SUBMITTED, REVIEWED, FLAGGED] }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date }
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
 *                       items: { $ref: '#/components/schemas/DailyWorkUpdate' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/', ctrl.listWorkUpdates);

/**
 * @swagger
 * /work-updates:
 *   post:
 *     tags: [WorkUpdates]
 *     summary: Submit (or update) today's daily work update
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, summary]
 *             properties:
 *               date: { type: string, format: date }
 *               summary: { type: string }
 *               tasksCompleted: { type: string, nullable: true }
 *               blockers: { type: string, nullable: true }
 *               planForTomorrow: { type: string, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/DailyWorkUpdate' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/', ctrl.submitWorkUpdate);

/**
 * @swagger
 * /work-updates/{id}/review:
 *   patch:
 *     tags: [WorkUpdates]
 *     summary: Review a submitted work update (manager feedback)
 *     description: Requires the `workupdate:review` permission.
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [REVIEWED, FLAGGED] }
 *               managerFeedback: { type: string, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/DailyWorkUpdate' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — missing workupdate:review permission, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Work update not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.patch('/:id/review', can('workupdate', 'review'), ctrl.reviewWorkUpdate);

module.exports = router;
