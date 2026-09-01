const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/attendance.controller');

router.use(authenticate);

/**
 * @swagger
 * /attendance/clock-in:
 *   post:
 *     tags: [Attendance]
 *     summary: Clock in for the current authenticated user
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
 *                     data: { $ref: '#/components/schemas/Attendance' }
 *       409:
 *         description: Already clocked in today
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/clock-in', ctrl.clockIn);
/**
 * @swagger
 * /attendance/clock-out:
 *   post:
 *     tags: [Attendance]
 *     summary: Clock out for the current authenticated user
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
 *                     data: { $ref: '#/components/schemas/Attendance' }
 *       409:
 *         description: Not clocked in, or already clocked out
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/clock-out', ctrl.clockOut);
/**
 * @swagger
 * /attendance/me:
 *   get:
 *     tags: [Attendance]
 *     summary: Get the caller's own attendance records
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *                       items: { $ref: '#/components/schemas/Attendance' }
 */
router.get('/me', ctrl.myAttendance);
/**
 * @swagger
 * /attendance/summary:
 *   get:
 *     tags: [Attendance]
 *     summary: Get an aggregate attendance summary for the caller
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *                       type: object
 *                       description: Aggregate attendance summary
 */
router.get('/summary', ctrl.summary);
/**
 * @swagger
 * /attendance:
 *   get:
 *     tags: [Attendance]
 *     summary: List attendance records
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: userId, in: query, schema: { type: string, format: uuid } }
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
 *       - { name: status, in: query, schema: { type: string, enum: [PRESENT, LATE, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY, WEEKEND] } }
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
 *                       items: { $ref: '#/components/schemas/Attendance' }
 *       403:
 *         description: Forbidden — requires attendance:view permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', can('attendance', 'view'), ctrl.listAttendance);
/**
 * @swagger
 * /attendance/mark:
 *   post:
 *     tags: [Attendance]
 *     summary: Manually mark attendance for a user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date, status]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               date: { type: string, format: date }
 *               status: { type: string, enum: [PRESENT, LATE, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY, WEEKEND] }
 *               workHours: { type: number, nullable: true }
 *               notes: { type: string, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/Attendance' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — requires attendance:mark permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/mark', can('attendance', 'mark'), ctrl.markAttendance);

module.exports = router;
