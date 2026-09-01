const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/permission.controller');

router.use(authenticate, isSuperAdmin);

/**
 * @swagger
 * /permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: List the configurable Admin permission matrix
 *     description: SUPER_ADMIN only. SUPER_ADMIN itself always has full access and is never represented in this matrix — only the ADMIN role's toggleable permissions are listed.
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
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Permission' }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', ctrl.listPermissions);
/**
 * @swagger
 * /permissions:
 *   put:
 *     tags: [Permissions]
 *     summary: Bulk update the Admin permission matrix
 *     description: SUPER_ADMIN only. Upserts each (module, action) pair for the ADMIN role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     module: { type: string }
 *                     action: { type: string }
 *                     allowed: { type: boolean }
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
 *                       items: { $ref: '#/components/schemas/Permission' }
 *       403:
 *         description: Forbidden (SUPER_ADMIN only)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/', ctrl.updatePermissions);

module.exports = router;
