const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/auditLog.controller');

router.use(authenticate, isSuperAdmin);

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     tags: [AuditLogs]
 *     summary: List audit log entries
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: module
 *         in: query
 *         schema: { type: string }
 *         description: "Filter by module name (e.g. USER, TIMESHEET, WORKSHOP)"
 *       - { name: entityId, in: query, schema: { type: string } }
 *       - { name: actorId, in: query, schema: { type: string, format: uuid } }
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
 *                       items: { $ref: '#/components/schemas/AuditLog' }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', ctrl.listAuditLogs);

module.exports = router;
