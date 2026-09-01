const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/settings.controller');

router.use(authenticate);

/**
 * @swagger
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get application settings
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
 *                         id: { type: string, format: uuid }
 *                         companyName: { type: string }
 *                         companyAddress: { type: string, nullable: true }
 *                         companyLogoUrl: { type: string, nullable: true }
 *                         signatoryName: { type: string, nullable: true }
 *                         signatoryTitle: { type: string, nullable: true }
 */
router.get('/', ctrl.getSettings);
/**
 * @swagger
 * /settings:
 *   put:
 *     tags: [Settings]
 *     summary: Update application settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName: { type: string }
 *               companyAddress: { type: string, nullable: true }
 *               companyLogoUrl: { type: string, nullable: true }
 *               signatoryName: { type: string, nullable: true }
 *               signatoryTitle: { type: string, nullable: true }
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
 *                         id: { type: string, format: uuid }
 *                         companyName: { type: string }
 *                         companyAddress: { type: string, nullable: true }
 *                         companyLogoUrl: { type: string, nullable: true }
 *                         signatoryName: { type: string, nullable: true }
 *                         signatoryTitle: { type: string, nullable: true }
 *       403:
 *         description: Forbidden — SUPER_ADMIN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/', isSuperAdmin, ctrl.updateSettings);

module.exports = router;
