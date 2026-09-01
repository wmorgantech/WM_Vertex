const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/enquiry.controller');

router.use(authenticate);

/**
 * @swagger
 * /enquiries:
 *   get:
 *     tags: [Enquiries]
 *     summary: List enquiries
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: source, in: query, schema: { type: string } }
 *       - { name: assignedEmployeeId, in: query, schema: { type: string, format: uuid } }
 *       - { name: search, in: query, schema: { type: string } }
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
 *                           - $ref: '#/components/schemas/Enquiry'
 *                           - type: object
 *                             properties:
 *                               followUpOverdue:
 *                                 type: boolean
 *                                 description: Computed - true when the follow-up date has passed and the enquiry is not yet resolved
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', ctrl.listEnquiries);
// Open to any staff role — interns/trainees excluded, everyone else may log
// an enquiry they've taken (e.g. an inbound call). See enquiry.controller.js.
/**
 * @swagger
 * /enquiries:
 *   post:
 *     tags: [Enquiries]
 *     summary: Create an enquiry
 *     description: Open to SUPER_ADMIN, ADMIN, and EMPLOYEE roles. Non-managers are auto-assigned to themselves regardless of any `assignedEmployeeId` sent in the body.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Enquiry'
 *             required: [contactName, subject]
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
 *                     data: { $ref: '#/components/schemas/Enquiry' }
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
router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), ctrl.createEnquiry);
/**
 * @swagger
 * /enquiries/{id}:
 *   get:
 *     tags: [Enquiries]
 *     summary: Get an enquiry by ID
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
 *                     data: { $ref: '#/components/schemas/Enquiry' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id', ctrl.getEnquiry);
// No route-level gate on update — the assigned employee may update their own
// enquiry's status/notes even without a manager role; the controller checks
// manager-or-assignee.
/**
 * @swagger
 * /enquiries/{id}:
 *   put:
 *     tags: [Enquiries]
 *     summary: Update an enquiry
 *     description: Partial update. Only a manager or the assigned employee may update; only a manager may reassign the enquiry (enforced in the controller, not by route-level middleware).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Enquiry'
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
 *                     data: { $ref: '#/components/schemas/Enquiry' }
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
router.put('/:id', ctrl.updateEnquiry);
/**
 * @swagger
 * /enquiries/{id}:
 *   delete:
 *     tags: [Enquiries]
 *     summary: Delete an enquiry
 *     description: SUPER_ADMIN only.
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
router.delete('/:id', isSuperAdmin, ctrl.deleteEnquiry);

module.exports = router;
