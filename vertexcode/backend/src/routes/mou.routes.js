const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/college.controller');

router.use(authenticate);

/**
 * @swagger
 * /mous:
 *   get:
 *     tags: [MOUs]
 *     summary: List MOUs
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
 *                       items: { $ref: '#/components/schemas/MOU' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', can('mou', 'manage'), ctrl.listMous);
/**
 * @swagger
 * /mous:
 *   post:
 *     tags: [MOUs]
 *     summary: Create an MOU
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collegeId]
 *             properties:
 *               collegeId: { type: string, format: uuid }
 *               collegeDepartmentId: { type: string, format: uuid }
 *               contactPerson: { type: string }
 *               mouType: { type: string }
 *               purpose: { type: string }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               status: { type: string }
 *               assignedEmployeeId: { type: string, format: uuid }
 *               signedDate: { type: string, format: date-time }
 *               renewalDate: { type: string, format: date-time }
 *               documentPath: { type: string }
 *               documentName: { type: string }
 *               remarks: { type: string }
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
 *                     data: { $ref: '#/components/schemas/MOU' }
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
router.post('/', can('mou', 'manage'), ctrl.createMou);
/**
 * @swagger
 * /mous/{id}:
 *   get:
 *     tags: [MOUs]
 *     summary: Get an MOU by ID
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
 *                     data: { $ref: '#/components/schemas/MOU' }
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
router.get('/:id', can('mou', 'manage'), ctrl.getMou);
/**
 * @swagger
 * /mous/{id}:
 *   put:
 *     tags: [MOUs]
 *     summary: Update an MOU
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
 *               collegeDepartmentId: { type: string, format: uuid }
 *               contactPerson: { type: string }
 *               mouType: { type: string }
 *               purpose: { type: string }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               status: { type: string }
 *               assignedEmployeeId: { type: string, format: uuid }
 *               signedDate: { type: string, format: date-time }
 *               renewalDate: { type: string, format: date-time }
 *               documentPath: { type: string }
 *               documentName: { type: string }
 *               remarks: { type: string }
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
 *                     data: { $ref: '#/components/schemas/MOU' }
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
router.put('/:id', can('mou', 'manage'), ctrl.updateMou);
/**
 * @swagger
 * /mous/{id}:
 *   delete:
 *     tags: [MOUs]
 *     summary: Delete an MOU
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
router.delete('/:id', isSuperAdmin, ctrl.deleteMou);

/**
 * @swagger
 * /mous/{id}/document:
 *   post:
 *     tags: [MOUs]
 *     summary: Attach or replace the signed MOU document (PDF/JPG/PNG, max 5MB)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: MOU not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/:id/document', can('mou', 'manage'), upload.single('file'), ctrl.uploadMouDocument);

/**
 * @swagger
 * /mous/{id}/document:
 *   get:
 *     tags: [MOUs]
 *     summary: Download the attached MOU document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: File stream
 *       401:
 *         description: Unauthorized
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
router.get('/:id/document', can('mou', 'manage'), ctrl.downloadMouDocument);

module.exports = router;
