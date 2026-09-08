const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { authorize, isSuperAdmin } = require('../middleware/rbac');
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
 * /documents/summary:
 *   get:
 *     tags: [Documents]
 *     summary: Real counts for the Intern Documents summary cards
 *     description: SUPER_ADMIN unrestricted; ADMIN scoped to interns they mentor.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 */
router.get('/summary', can('document', 'view'), ctrl.summary);

/**
 * @swagger
 * /documents/trash:
 *   get:
 *     tags: [Documents]
 *     summary: List soft-deleted (Trash) documents
 *     description: SUPER_ADMIN unrestricted; ADMIN scoped to interns they mentor.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 */
router.get('/trash', can('document', 'view'), ctrl.listTrash);

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
 * /documents/{id}/remarks:
 *   patch:
 *     tags: [Documents]
 *     summary: Edit a document's admin remarks (Edit)
 *     description: >
 *       The only intentionally-editable field — the uploaded file, fileName,
 *       type and status stay immutable outside upload/approve/reject, to
 *       preserve the review audit trail. Same gate as approve
 *       (document:approve permission + Admin mentor-scoping).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [remarks], properties: { remarks: { type: string, nullable: true } } }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403:
 *         description: Forbidden — requires document:approve permission, or an Admin who doesn't mentor this intern
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:id/remarks', can('document', 'approve'), ctrl.updateRemarks);

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Soft-delete (move to Trash) a document
 *     description: SUPER_ADMIN only — deleting a review record is more sensitive than approving/rejecting one, so this is not opened up to Admins.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       400:
 *         description: Already in Trash
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
router.delete('/:id', isSuperAdmin, ctrl.deleteDocument);

/**
 * @swagger
 * /documents/{id}/restore:
 *   post:
 *     tags: [Documents]
 *     summary: Restore a soft-deleted (Trash) document
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
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       400:
 *         description: Not in Trash
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
router.post('/:id/restore', isSuperAdmin, ctrl.restoreDocument);

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
