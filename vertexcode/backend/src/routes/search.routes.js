const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/search.controller');

router.use(authenticate, isManager);

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Search across entities (users, tasks, projects, etc.)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: q, in: query, required: true, description: Search string, schema: { type: string } }
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
 *                       description: Results grouped by entity type
 *                       properties:
 *                         users:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/User' }
 *                         tasks:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Task' }
 *                         projects:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Project' }
 *       400:
 *         description: Missing search query
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — manager only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', ctrl.search);

module.exports = router;
