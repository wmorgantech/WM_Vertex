const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/expense.controller');

router.use(authenticate);

// Financial data — hard-restricted to Super Admin only (business rule, not
// routed through the configurable Admin permission matrix like other
// transactional modules). Admin cannot be granted this even by toggling a
// permission — see Permissions.jsx, which no longer exposes an Expense row.
/**
 * @swagger
 * /expenses/summary:
 *   get:
 *     tags: [Expenses]
 *     summary: Get expense totals summary
 *     description: SUPER_ADMIN only.
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
 *                       description: Aggregate expense totals (e.g. by category, by month)
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/summary', isSuperAdmin, ctrl.summary);
/**
 * @swagger
 * /expenses:
 *   get:
 *     tags: [Expenses]
 *     summary: List expenses
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
 *       - { name: categoryCode, in: query, schema: { type: string } }
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
 *                       items: { $ref: '#/components/schemas/Expense' }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', isSuperAdmin, ctrl.list);
/**
 * @swagger
 * /expenses:
 *   post:
 *     tags: [Expenses]
 *     summary: Create an expense
 *     description: SUPER_ADMIN only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Expense'
 *             required: [categoryCode, title, amount, expenseDate]
 *             properties:
 *               description: { type: string }
 *               paymentMode: { type: string }
 *               reference: { type: string }
 *               vendor: { type: string }
 *               linkType: { type: string }
 *               linkId: { type: string, format: uuid }
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
 *                     data: { $ref: '#/components/schemas/Expense' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', isSuperAdmin, ctrl.create);
/**
 * @swagger
 * /expenses/{id}:
 *   put:
 *     tags: [Expenses]
 *     summary: Update an expense
 *     description: SUPER_ADMIN only. Partial update.
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
 *               categoryCode: { type: string }
 *               title: { type: string }
 *               amount: { type: number }
 *               expenseDate: { type: string, format: date }
 *               description: { type: string }
 *               paymentMode: { type: string }
 *               reference: { type: string }
 *               vendor: { type: string }
 *               linkType: { type: string }
 *               linkId: { type: string, format: uuid }
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
 *                     data: { $ref: '#/components/schemas/Expense' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/:id', isSuperAdmin, ctrl.update);
/**
 * @swagger
 * /expenses/{id}:
 *   delete:
 *     tags: [Expenses]
 *     summary: Delete an expense
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
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:id', isSuperAdmin, ctrl.remove);

module.exports = router;
