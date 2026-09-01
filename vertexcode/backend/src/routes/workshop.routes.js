const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/college.controller');

router.use(authenticate);

/**
 * @swagger
 * /workshops:
 *   get:
 *     tags: [Workshops]
 *     summary: List workshops
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: collegeId, in: query, schema: { type: string, format: uuid } }
 *       - { name: assignedEmployeeId, in: query, schema: { type: string, format: uuid } }
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
 *                           - $ref: '#/components/schemas/Workshop'
 *                           - type: object
 *                             properties:
 *                               followUpOverdue:
 *                                 type: boolean
 *                                 description: Computed - true when the follow-up date has passed and the workshop is not yet resolved
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', ctrl.listWorkshops);
/**
 * @swagger
 * /workshops:
 *   post:
 *     tags: [Workshops]
 *     summary: Create a workshop
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collegeId, topic]
 *             properties:
 *               collegeId: { type: string, format: uuid }
 *               topic: { type: string }
 *               collegeDepartmentId: { type: string, format: uuid }
 *               contactPerson: { type: string }
 *               contactNumber: { type: string }
 *               contactEmail: { type: string }
 *               technology: { type: string }
 *               proposedDate: { type: string, format: date-time }
 *               duration: { type: string }
 *               expectedParticipants: { type: integer }
 *               assignedEmployeeId: { type: string, format: uuid }
 *               trainerId: { type: string, format: uuid }
 *               status: { type: string }
 *               followUpDate: { type: string, format: date-time }
 *               discussionNotes: { type: string }
 *               nextAction: { type: string }
 *               remarks: { type: string }
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
 *                     data: { $ref: '#/components/schemas/Workshop' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', can('workshop', 'manage'), ctrl.createWorkshop);
/**
 * @swagger
 * /workshops/{id}:
 *   get:
 *     tags: [Workshops]
 *     summary: Get a workshop by ID (includes college, department, assignee, and trainer)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
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
 *                     data: { $ref: '#/components/schemas/Workshop' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id', ctrl.getWorkshop);
// No route-level gate on update — the assigned employee may update their own
// workshop's status/notes even without the broader "manage" permission; the
// controller checks manager-or-assignee.
/**
 * @swagger
 * /workshops/{id}:
 *   put:
 *     tags: [Workshops]
 *     summary: Update a workshop
 *     description: Partial update. Only managers may reassign `assignedEmployeeId`/`trainerId`; the assigned employee may update status/notes on their own workshop (enforced in the controller, not by route-level middleware).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic: { type: string }
 *               collegeDepartmentId: { type: string, format: uuid }
 *               contactPerson: { type: string }
 *               contactNumber: { type: string }
 *               contactEmail: { type: string }
 *               technology: { type: string }
 *               proposedDate: { type: string, format: date-time }
 *               duration: { type: string }
 *               expectedParticipants: { type: integer }
 *               assignedEmployeeId: { type: string, format: uuid }
 *               trainerId: { type: string, format: uuid }
 *               status: { type: string }
 *               followUpDate: { type: string, format: date-time }
 *               discussionNotes: { type: string }
 *               nextAction: { type: string }
 *               remarks: { type: string }
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
 *                     data: { $ref: '#/components/schemas/Workshop' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/:id', ctrl.updateWorkshop);
/**
 * @swagger
 * /workshops/{id}:
 *   delete:
 *     tags: [Workshops]
 *     summary: Delete a workshop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:id', isSuperAdmin, ctrl.deleteWorkshop);

module.exports = router;
