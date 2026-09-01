const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/document.controller');

router.use(authenticate);

/**
 * @swagger
 * /documents/mine:
 *   get:
 *     tags: [Documents]
 *     summary: Get the caller's own documents (INTERN)
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
 *                       items: { $ref: '#/components/schemas/InternDocument' }
 *       403:
 *         description: Forbidden — INTERN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/mine', authorize('INTERN'), ctrl.getMine);
/**
 * @swagger
 * /documents/upload:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document (INTERN)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               type: { type: string, enum: [BONAFIDE, COLLEGE_ID, RESUME, ADDITIONAL, PERMISSION_LETTER] }
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
 *                     data: { $ref: '#/components/schemas/InternDocument' }
 *       400:
 *         description: Missing file or invalid type
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — INTERN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/upload', authorize('INTERN'), upload.single('file'), ctrl.uploadDocument);
/**
 * @swagger
 * /documents/submit:
 *   post:
 *     tags: [Documents]
 *     summary: Submit uploaded documents for verification (INTERN)
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
 *                         message: { type: string }
 *       403:
 *         description: Forbidden — INTERN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/submit', authorize('INTERN'), ctrl.submitForVerification);

/**
 * @swagger
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: List all documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [DRAFT, PENDING_REVIEW, REJECTED, VERIFIED] } }
 *       - { name: enrollmentId, in: query, schema: { type: string, format: uuid } }
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
 *                       items: { $ref: '#/components/schemas/InternDocument' }
 *       403:
 *         description: Forbidden — requires document:view permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', can('document', 'view'), ctrl.listAll);
/**
 * @swagger
 * /documents/enrollment/{enrollmentId}:
 *   get:
 *     tags: [Documents]
 *     summary: Get an enrollment's document detail (documents, offer letter, certificate)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: enrollmentId, in: path, required: true, schema: { type: string, format: uuid } }
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
 *                       allOf:
 *                         - $ref: '#/components/schemas/InternEnrollment'
 *                         - type: object
 *                           properties:
 *                             documents:
 *                               type: array
 *                               items: { $ref: '#/components/schemas/InternDocument' }
 *                             offerLetter: { type: object, nullable: true }
 *                             certificate: { type: object, nullable: true }
 *       403:
 *         description: Forbidden — requires document:view permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/enrollment/:enrollmentId', can('document', 'view'), ctrl.getEnrollmentDetail);
/**
 * @swagger
 * /documents/{id}/approve:
 *   patch:
 *     tags: [Documents]
 *     summary: Approve a document
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
 *                     data: { $ref: '#/components/schemas/InternDocument' }
 *       403:
 *         description: Forbidden — requires document:approve permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:id/approve', can('document', 'approve'), ctrl.approve);
/**
 * @swagger
 * /documents/{id}/reject:
 *   patch:
 *     tags: [Documents]
 *     summary: Reject a document
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
 *             required: [remarks]
 *             properties:
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
 *                     data: { $ref: '#/components/schemas/InternDocument' }
 *       400:
 *         description: Missing remarks
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — requires document:reject permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:id/reject', can('document', 'reject'), ctrl.reject);

/**
 * @swagger
 * /documents/{id}/download:
 *   get:
 *     tags: [Documents]
 *     summary: Download a document file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: File stream
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Forbidden — owner, mentor, or SUPER_ADMIN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id/download', ctrl.download);

module.exports = router;
