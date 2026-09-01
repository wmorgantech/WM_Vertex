const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/analytics.controller');

router.use(authenticate);

/**
 * @swagger
 * /analytics/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: Org-wide analytics overview (headcounts, approvals, finance, etc.)
 *     description: Requires the `analytics:view` permission. Some sections (reports, offer letters, certificates, audit) are only included for SUPER_ADMIN.
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
 *                       type: object
 *                       description: Org-wide dashboard — headcounts, project/task stats, attendance rollups, pending approvals, document/finance/BD summaries.
 *                       properties:
 *                         headcount:
 *                           type: object
 *                           properties:
 *                             totalEmployees: { type: integer }
 *                             totalInterns: { type: integer }
 *                             totalTrainees: { type: integer }
 *                             activeUsers: { type: integer }
 *                             totalDepartments: { type: integer }
 *                         pendingApprovals:
 *                           type: object
 *                           properties:
 *                             timesheets: { type: integer }
 *                             workUpdates: { type: integer }
 *                         finance:
 *                           type: object
 *                           properties:
 *                             totalExpenses: { type: number }
 *                             last30DaysExpenses: { type: number }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — missing analytics:view permission, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/overview', can('analytics', 'view'), ctrl.overview);

/**
 * @swagger
 * /analytics/team:
 *   get:
 *     tags: [Analytics]
 *     summary: Team performance rollup
 *     description: Requires the `analytics:view` permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: departmentId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: managerId
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
 *                       description: One entry per team member with task/attendance/timesheet rollups.
 *                       items:
 *                         type: object
 *                         properties:
 *                           user: { $ref: '#/components/schemas/User' }
 *                           tasksDone: { type: integer }
 *                           tasksTotal: { type: integer }
 *                           taskCompletionRate: { type: integer }
 *                           attendanceDaysLast30: { type: integer }
 *                           hoursLoggedLast30: { type: number }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — missing analytics:view permission, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/team', can('analytics', 'view'), ctrl.teamPerformance);

/**
 * @swagger
 * /analytics/interns:
 *   get:
 *     tags: [Analytics]
 *     summary: Intern program performance rollup
 *     description: Requires the `analytics:view` permission.
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
 *                       type: object
 *                       properties:
 *                         enrollments:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/InternEnrollment' }
 *                         byStatus:
 *                           type: object
 *                           description: Enrollment counts keyed by completionStatus.
 *                         averagePerformanceRating: { type: number, nullable: true }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — missing analytics:view permission, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/interns', can('analytics', 'view'), ctrl.internPerformance);

/**
 * @swagger
 * /analytics/me:
 *   get:
 *     tags: [Analytics]
 *     summary: Caller's own personal performance dashboard
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
 *                       type: object
 *                       properties:
 *                         tasks:
 *                           type: object
 *                           properties:
 *                             done: { type: integer }
 *                             total: { type: integer }
 *                             overdue: { type: integer }
 *                         hoursLoggedLast30: { type: number }
 *                         pendingTimesheets: { type: integer }
 *                         workUpdatesSubmittedLast30: { type: integer }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/me', ctrl.myPerformance);

module.exports = router;
