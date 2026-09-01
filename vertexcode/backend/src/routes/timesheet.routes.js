const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/timesheet.controller');

router.use(authenticate);

// Static-path routes registered before the /:id-shaped ones below —
// otherwise Express would match e.g. PATCH /bulk/approve as { id: 'bulk' }
// against PATCH /:id/approve. See masters/leave/notification routes for
// the same established pattern.
/**
 * @swagger
 * /timesheets/summary:
 *   get:
 *     tags: [Timesheets]
 *     summary: Get a day-by-day timesheet summary with rollup totals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: userId, in: query, schema: { type: string, format: uuid } }
 *       - { name: from, in: query, required: true, schema: { type: string, format: date } }
 *       - { name: to, in: query, required: true, schema: { type: string, format: date } }
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
 *                       type: object
 *                       properties:
 *                         expectedHours: { type: number }
 *                         actualHours: { type: number }
 *                         difference: { type: number }
 *                         workingDays: { type: integer }
 *                         status: { type: string }
 *                         days:
 *                           type: array
 *                           items: { type: object }
 *                         entries:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Timesheet' }
 *       400:
 *         description: Missing from or to
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/summary', ctrl.getSummary);
/**
 * @swagger
 * /timesheets/team-summary:
 *   get:
 *     tags: [Timesheets]
 *     summary: Get per-team-member timesheet summaries (manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: from, in: query, required: true, schema: { type: string, format: date } }
 *       - { name: to, in: query, required: true, schema: { type: string, format: date } }
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
 *                           userId: { type: string, format: uuid }
 *                           expectedHours: { type: number }
 *                           actualHours: { type: number }
 *                           difference: { type: number }
 *                           status: { type: string }
 *       400:
 *         description: Missing from or to
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — manager only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/team-summary', ctrl.getTeamSummary);
/**
 * @swagger
 * /timesheets/bulk:
 *   post:
 *     tags: [Timesheets]
 *     summary: Bulk upsert timesheet entries
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entries]
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [date, hoursLogged]
 *                   properties:
 *                     id: { type: string, format: uuid, nullable: true }
 *                     date: { type: string, format: date }
 *                     position: { type: string, nullable: true }
 *                     projectId: { type: string, format: uuid, nullable: true }
 *                     hoursLogged: { type: number }
 *                     description: { type: string, nullable: true }
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
 *                       items: { $ref: '#/components/schemas/Timesheet' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/bulk', ctrl.bulkUpsertTimesheets);
/**
 * @swagger
 * /timesheets/submit:
 *   post:
 *     tags: [Timesheets]
 *     summary: Submit draft timesheets in a date range for approval
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from, to]
 *             properties:
 *               from: { type: string, format: date }
 *               to: { type: string, format: date }
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
 *                       type: object
 *                       properties:
 *                         submitted: { type: integer }
 *       400:
 *         description: Missing from or to
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/submit', ctrl.submitTimesheets);
/**
 * @swagger
 * /timesheets/bulk/approve:
 *   patch:
 *     tags: [Timesheets]
 *     summary: Bulk approve timesheets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
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
 *                       items: { $ref: '#/components/schemas/Timesheet' }
 *       400:
 *         description: Missing ids
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — requires timesheet:approve permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/bulk/approve', can('timesheet', 'approve'), ctrl.bulkApprove);
/**
 * @swagger
 * /timesheets/bulk/reject:
 *   patch:
 *     tags: [Timesheets]
 *     summary: Bulk reject timesheets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               reason: { type: string, nullable: true }
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
 *                       items: { $ref: '#/components/schemas/Timesheet' }
 *       400:
 *         description: Missing ids
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — requires timesheet:reject permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/bulk/reject', can('timesheet', 'reject'), ctrl.bulkReject);

/**
 * @swagger
 * /timesheets:
 *   get:
 *     tags: [Timesheets]
 *     summary: List timesheets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: userId, in: query, schema: { type: string, format: uuid } }
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: projectId, in: query, schema: { type: string, format: uuid } }
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
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
 *                       items: { $ref: '#/components/schemas/Timesheet' }
 */
router.get('/', ctrl.listTimesheets);
/**
 * @swagger
 * /timesheets:
 *   post:
 *     tags: [Timesheets]
 *     summary: Create a timesheet entry
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, hoursLogged]
 *             properties:
 *               date: { type: string, format: date }
 *               hoursLogged: { type: number }
 *               projectId: { type: string, format: uuid, nullable: true }
 *               taskId: { type: string, format: uuid, nullable: true }
 *               description: { type: string, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/Timesheet' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', ctrl.createTimesheet);
/**
 * @swagger
 * /timesheets/{id}:
 *   put:
 *     tags: [Timesheets]
 *     summary: Update a timesheet entry (owner only; DRAFT/REJECTED only)
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
 *               date: { type: string, format: date }
 *               hoursLogged: { type: number }
 *               projectId: { type: string, format: uuid, nullable: true }
 *               taskId: { type: string, format: uuid, nullable: true }
 *               description: { type: string, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/Timesheet' }
 *       403:
 *         description: Forbidden — not the owner, or entry not in DRAFT/REJECTED status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/:id', ctrl.updateTimesheet);
/**
 * @swagger
 * /timesheets/{id}/approve:
 *   patch:
 *     tags: [Timesheets]
 *     summary: Approve a timesheet entry
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
 *                     data: { $ref: '#/components/schemas/Timesheet' }
 *       403:
 *         description: Forbidden — requires timesheet:approve permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:id/approve', can('timesheet', 'approve'), ctrl.approveTimesheet);
/**
 * @swagger
 * /timesheets/{id}/reject:
 *   patch:
 *     tags: [Timesheets]
 *     summary: Reject a timesheet entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/Timesheet' }
 *       403:
 *         description: Forbidden — requires timesheet:reject permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:id/reject', can('timesheet', 'reject'), ctrl.rejectTimesheet);
/**
 * @swagger
 * /timesheets/{id}:
 *   delete:
 *     tags: [Timesheets]
 *     summary: Delete a timesheet entry (owner only; DRAFT/REJECTED only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403:
 *         description: Forbidden — not the owner, or entry not in DRAFT/REJECTED status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:id', ctrl.deleteTimesheet);

module.exports = router;
