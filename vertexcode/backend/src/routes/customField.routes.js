const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin, isManager } = require('../middleware/rbac');
const ctrl = require('../controllers/customField.controller');

router.use(authenticate);

// Static paths (/all, /values) must be registered before the /:id param
// route below, or Express matches them as { id: "values" } etc. instead.
/**
 * @swagger
 * /custom-fields/all:
 *   get:
 *     tags: [CustomFields]
 *     summary: List all custom field definitions (including inactive)
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
 *                       items: { $ref: '#/components/schemas/CustomFieldDefinition' }
 *       403:
 *         description: Forbidden — SUPER_ADMIN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/all', isSuperAdmin, ctrl.listAllDefinitions);

// Values attach to records (employees, interns, colleges...) that only
// managers can otherwise edit, so setting them is manager-only too.
/**
 * @swagger
 * /custom-fields/values:
 *   get:
 *     tags: [CustomFields]
 *     summary: Get custom field values for a specific record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: entityType, in: query, required: true, schema: { type: string, enum: [EMPLOYEE, INTERN, TRAINEE, COLLEGE, WORKSHOP] } }
 *       - { name: entityId, in: query, required: true, schema: { type: string, format: uuid } }
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
 *                       items:
 *                         type: object
 *                         properties:
 *                           fieldId: { type: string, format: uuid }
 *                           value: {}
 *       400:
 *         description: Missing entityType or entityId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/values', ctrl.getValues);
/**
 * @swagger
 * /custom-fields/values:
 *   put:
 *     tags: [CustomFields]
 *     summary: Set custom field values for a specific record
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType, entityId, values]
 *             properties:
 *               entityType: { type: string, enum: [EMPLOYEE, INTERN, TRAINEE, COLLEGE, WORKSHOP] }
 *               entityId: { type: string, format: uuid }
 *               values:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fieldId: { type: string, format: uuid }
 *                     value: {}
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
 *       403:
 *         description: Forbidden — manager only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/values', isManager, ctrl.setValues);

// Reads are open to any authenticated user — a form needs to know which
// custom fields to render. Definition management is Super Admin only.
/**
 * @swagger
 * /custom-fields:
 *   get:
 *     tags: [CustomFields]
 *     summary: List active custom field definitions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: entityType, in: query, schema: { type: string, enum: [EMPLOYEE, INTERN, TRAINEE, COLLEGE, WORKSHOP] } }
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
 *                       items: { $ref: '#/components/schemas/CustomFieldDefinition' }
 */
router.get('/', ctrl.listDefinitions);
/**
 * @swagger
 * /custom-fields:
 *   post:
 *     tags: [CustomFields]
 *     summary: Create a custom field definition
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType, name, fieldType]
 *             properties:
 *               entityType: { type: string, enum: [EMPLOYEE, INTERN, TRAINEE, COLLEGE, WORKSHOP] }
 *               name: { type: string }
 *               fieldType: { type: string, enum: [TEXT, NUMBER, DATE, DROPDOWN, MULTISELECT, CHECKBOX, TEXTAREA] }
 *               options:
 *                 type: array
 *                 items: { type: string }
 *               required: { type: boolean }
 *               sortOrder: { type: integer }
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
 *                     data: { $ref: '#/components/schemas/CustomFieldDefinition' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — SUPER_ADMIN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', isSuperAdmin, ctrl.createDefinition);
/**
 * @swagger
 * /custom-fields/{id}:
 *   put:
 *     tags: [CustomFields]
 *     summary: Update a custom field definition
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
 *               name: { type: string }
 *               fieldType: { type: string, enum: [TEXT, NUMBER, DATE, DROPDOWN, MULTISELECT, CHECKBOX, TEXTAREA] }
 *               options:
 *                 type: array
 *                 items: { type: string }
 *               required: { type: boolean }
 *               active: { type: boolean }
 *               sortOrder: { type: integer }
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
 *                     data: { $ref: '#/components/schemas/CustomFieldDefinition' }
 *       403:
 *         description: Forbidden — SUPER_ADMIN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/:id', isSuperAdmin, ctrl.updateDefinition);
/**
 * @swagger
 * /custom-fields/{id}:
 *   delete:
 *     tags: [CustomFields]
 *     summary: Delete a custom field definition
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
 *       403:
 *         description: Forbidden — SUPER_ADMIN only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:id', isSuperAdmin, ctrl.deleteDefinition);

module.exports = router;
