const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/report.controller');

// Export is deliberately hard-restricted to Super Admin — not routed through
// the configurable Admin permission matrix, per explicit business rule
// ("only Super Admin can export the reports"). Admins cannot be granted this
// even by toggling a permission.
router.use(authenticate, isSuperAdmin);

/**
 * @swagger
 * /reports/employees:
 *   get:
 *     tags: [Reports]
 *     summary: Export employees report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/employees', ctrl.exportEmployees);
/**
 * @swagger
 * /reports/attendance:
 *   get:
 *     tags: [Reports]
 *     summary: Export attendance report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/attendance', ctrl.exportAttendance);
/**
 * @swagger
 * /reports/timesheets:
 *   get:
 *     tags: [Reports]
 *     summary: Export timesheets report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *       - { name: status, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/timesheets', ctrl.exportTimesheets);
/**
 * @swagger
 * /reports/tasks:
 *   get:
 *     tags: [Reports]
 *     summary: Export tasks report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *       - { name: status, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/tasks', ctrl.exportTasks);
/**
 * @swagger
 * /reports/interns:
 *   get:
 *     tags: [Reports]
 *     summary: Export interns report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/interns', ctrl.exportInterns);
/**
 * @swagger
 * /reports/trainees:
 *   get:
 *     tags: [Reports]
 *     summary: Export trainees report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/trainees', ctrl.exportTrainees);
/**
 * @swagger
 * /reports/expenses:
 *   get:
 *     tags: [Reports]
 *     summary: Export expenses report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
 *       - { name: categoryCode, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/expenses', ctrl.exportExpenses);
/**
 * @swagger
 * /reports/enquiries:
 *   get:
 *     tags: [Reports]
 *     summary: Export enquiries report
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx], default: csv } }
 *     responses:
 *       200:
 *         description: File download (CSV or XLSX depending on `format`); filename is set in the Content-Disposition header.
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enquiries', ctrl.exportEnquiries);

module.exports = router;
