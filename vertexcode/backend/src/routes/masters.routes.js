const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/masters.controller');

router.use(authenticate);

// Reads are available to any authenticated user (needed to populate dropdowns
// in employee/user forms). Writes are Super-Admin-only configuration.
/**
 * @swagger
 * /masters/designations:
 *   get:
 *     tags: [Masters]
 *     summary: List designations
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
 *                       items: { $ref: '#/components/schemas/Designation' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/designations', ctrl.listDesignations);

/**
 * @swagger
 * /masters/designations:
 *   post:
 *     tags: [Masters]
 *     summary: Create a designation
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               departmentId: { type: string, format: uuid, nullable: true }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Designation' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate designation, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/designations', isSuperAdmin, ctrl.createDesignation);

/**
 * @swagger
 * /masters/designations/{id}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a designation
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               departmentId: { type: string, format: uuid, nullable: true }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Designation' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Designation not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/designations/:id', isSuperAdmin, ctrl.updateDesignation);

/**
 * @swagger
 * /masters/designations/{id}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a designation
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Designation not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Designation is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/designations/:id', isSuperAdmin, ctrl.deleteDesignation);

/**
 * @swagger
 * /masters/locations:
 *   get:
 *     tags: [Masters]
 *     summary: List locations
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
 *                       items: { $ref: '#/components/schemas/Location' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/locations', ctrl.listLocations);

/**
 * @swagger
 * /masters/locations:
 *   post:
 *     tags: [Masters]
 *     summary: Create a location
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               address: { type: string, nullable: true }
 *               city: { type: string, nullable: true }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Location' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate location, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/locations', isSuperAdmin, ctrl.createLocation);

/**
 * @swagger
 * /masters/locations/{id}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a location
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               address: { type: string, nullable: true }
 *               city: { type: string, nullable: true }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Location' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Location not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/locations/:id', isSuperAdmin, ctrl.updateLocation);

/**
 * @swagger
 * /masters/locations/{id}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a location
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Location not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Location is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/locations/:id', isSuperAdmin, ctrl.deleteLocation);

/**
 * @swagger
 * /masters/employment-types:
 *   get:
 *     tags: [Masters]
 *     summary: List employment types
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/employment-types', ctrl.listEmploymentTypes);

/**
 * @swagger
 * /masters/employment-types:
 *   post:
 *     tags: [Masters]
 *     summary: Create an employment type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/employment-types', isSuperAdmin, ctrl.createEmploymentType);

/**
 * @swagger
 * /masters/employment-types/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update an employment type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Employment type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/employment-types/:code', isSuperAdmin, ctrl.updateEmploymentType);

/**
 * @swagger
 * /masters/employment-types/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete an employment type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Employment type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Employment type is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/employment-types/:code', isSuperAdmin, ctrl.deleteEmploymentType);

/**
 * @swagger
 * /masters/college-types:
 *   get:
 *     tags: [Masters]
 *     summary: List college types
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/college-types', ctrl.listCollegeTypes);

/**
 * @swagger
 * /masters/college-types:
 *   post:
 *     tags: [Masters]
 *     summary: Create a college type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/college-types', isSuperAdmin, ctrl.createCollegeType);

/**
 * @swagger
 * /masters/college-types/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a college type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: College type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/college-types/:code', isSuperAdmin, ctrl.updateCollegeType);

/**
 * @swagger
 * /masters/college-types/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a college type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: College type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: College type is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/college-types/:code', isSuperAdmin, ctrl.deleteCollegeType);

/**
 * @swagger
 * /masters/task-types:
 *   get:
 *     tags: [Masters]
 *     summary: List task types
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/task-types', ctrl.taskTypeCrud.list);

/**
 * @swagger
 * /masters/task-types:
 *   post:
 *     tags: [Masters]
 *     summary: Create a task type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/task-types', isSuperAdmin, ctrl.taskTypeCrud.create);

/**
 * @swagger
 * /masters/task-types/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a task type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Task type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/task-types/:code', isSuperAdmin, ctrl.taskTypeCrud.update);

/**
 * @swagger
 * /masters/task-types/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a task type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Task type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Task type is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/task-types/:code', isSuperAdmin, ctrl.taskTypeCrud.remove);

/**
 * @swagger
 * /masters/task-priorities:
 *   get:
 *     tags: [Masters]
 *     summary: List task priorities
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 */
router.get('/task-priorities', ctrl.taskPriorityCrud.list);

/**
 * @swagger
 * /masters/task-priorities:
 *   post:
 *     tags: [Masters]
 *     summary: Create a task priority
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               color: { type: string }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/task-priorities', isSuperAdmin, ctrl.taskPriorityCrud.create);

/**
 * @swagger
 * /masters/task-priorities/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a task priority
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               color: { type: string }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Task priority not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/task-priorities/:code', isSuperAdmin, ctrl.taskPriorityCrud.update);

/**
 * @swagger
 * /masters/task-priorities/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a task priority
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Task priority not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Task priority is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/task-priorities/:code', isSuperAdmin, ctrl.taskPriorityCrud.remove);

/**
 * @swagger
 * /masters/task-statuses:
 *   get:
 *     tags: [Masters]
 *     summary: List task statuses
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/task-statuses', ctrl.taskStatusCrud.list);

/**
 * @swagger
 * /masters/task-statuses:
 *   post:
 *     tags: [Masters]
 *     summary: Create a task status
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               color: { type: string }
 *               isFinal: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/task-statuses', isSuperAdmin, ctrl.taskStatusCrud.create);

/**
 * @swagger
 * /masters/task-statuses/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a task status
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               color: { type: string }
 *               isFinal: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Task status not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/task-statuses/:code', isSuperAdmin, ctrl.taskStatusCrud.update);

/**
 * @swagger
 * /masters/task-statuses/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a task status
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Task status not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Task status is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/task-statuses/:code', isSuperAdmin, ctrl.taskStatusCrud.remove);

/**
 * @swagger
 * /masters/timesheet-statuses:
 *   get:
 *     tags: [Masters]
 *     summary: List timesheet statuses
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/timesheet-statuses', ctrl.timesheetStatusCrud.list);

/**
 * @swagger
 * /masters/timesheet-statuses:
 *   post:
 *     tags: [Masters]
 *     summary: Create a timesheet status
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               color: { type: string }
 *               isFinal: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/timesheet-statuses', isSuperAdmin, ctrl.timesheetStatusCrud.create);

/**
 * @swagger
 * /masters/timesheet-statuses/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a timesheet status
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               color: { type: string }
 *               isFinal: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Timesheet status not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/timesheet-statuses/:code', isSuperAdmin, ctrl.timesheetStatusCrud.update);

/**
 * @swagger
 * /masters/timesheet-statuses/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a timesheet status
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Timesheet status not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Timesheet status is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/timesheet-statuses/:code', isSuperAdmin, ctrl.timesheetStatusCrud.remove);

/**
 * @swagger
 * /masters/leave-types:
 *   get:
 *     tags: [Masters]
 *     summary: List leave types
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/leave-types', ctrl.leaveTypeCrud.list);

/**
 * @swagger
 * /masters/leave-types:
 *   post:
 *     tags: [Masters]
 *     summary: Create a leave type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               paid: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/leave-types', isSuperAdmin, ctrl.leaveTypeCrud.create);

/**
 * @swagger
 * /masters/leave-types/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update a leave type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               paid: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Leave type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/leave-types/:code', isSuperAdmin, ctrl.leaveTypeCrud.update);

/**
 * @swagger
 * /masters/leave-types/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete a leave type
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Leave type not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Leave type is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/leave-types/:code', isSuperAdmin, ctrl.leaveTypeCrud.remove);

/**
 * @swagger
 * /masters/expense-categories:
 *   get:
 *     tags: [Masters]
 *     summary: List expense categories
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
 *                       items: { $ref: '#/components/schemas/CodeMaster' }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/expense-categories', ctrl.expenseCategoryCrud.list);

/**
 * @swagger
 * /masters/expense-categories:
 *   post:
 *     tags: [Masters]
 *     summary: Create an expense category
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Duplicate code, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/expense-categories', isSuperAdmin, ctrl.expenseCategoryCrud.create);

/**
 * @swagger
 * /masters/expense-categories/{code}:
 *   put:
 *     tags: [Masters]
 *     summary: Update an expense category
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               sortOrder: { type: integer }
 *               active: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/CodeMaster' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Expense category not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/expense-categories/:code', isSuperAdmin, ctrl.expenseCategoryCrud.update);

/**
 * @swagger
 * /masters/expense-categories/{code}:
 *   delete:
 *     tags: [Masters]
 *     summary: Delete an expense category
 *     description: Super Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *       403: { description: Forbidden — Super Admin only, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Expense category not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       409: { description: Expense category is in use and cannot be deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/expense-categories/:code', isSuperAdmin, ctrl.expenseCategoryCrud.remove);

module.exports = router;
