const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const ctrl = require('../controllers/task.controller');

router.use(authenticate);

/**
 * @swagger
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: priority, in: query, schema: { type: string } }
 *       - { name: type, in: query, schema: { type: string } }
 *       - { name: projectId, in: query, schema: { type: string, format: uuid } }
 *       - { name: assigneeId, in: query, schema: { type: string, format: uuid } }
 *       - { name: unallocated, in: query, schema: { type: boolean } }
 *       - { name: dueBefore, in: query, schema: { type: string, format: date-time } }
 *       - { name: dueAfter, in: query, schema: { type: string, format: date-time } }
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
 *                       items: { $ref: '#/components/schemas/Task' }
 */
router.get('/', ctrl.listTasks);
/**
 * @swagger
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string, nullable: true }
 *               type: { type: string }
 *               priority: { type: string }
 *               status: { type: string }
 *               projectId: { type: string, format: uuid, nullable: true }
 *               assigneeId: { type: string, format: uuid, nullable: true }
 *               dueDate: { type: string, format: date-time, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — requires task:create permission
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', can('task', 'create'), ctrl.createTask);
/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a task by id
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
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/Task'
 *                         - type: object
 *                           properties:
 *                             project: { $ref: '#/components/schemas/Project' }
 *                             assignee: { $ref: '#/components/schemas/User' }
 *                             createdBy: { $ref: '#/components/schemas/User' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id', ctrl.getTask);
/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     tags: [Tasks]
 *     summary: Update a task (owner or manager; only managers may reassign assigneeId)
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
 *               title: { type: string }
 *               description: { type: string, nullable: true }
 *               type: { type: string }
 *               priority: { type: string }
 *               status: { type: string }
 *               progress: { type: integer }
 *               projectId: { type: string, format: uuid, nullable: true }
 *               assigneeId: { type: string, format: uuid, nullable: true, description: Manager-only field }
 *               dueDate: { type: string, format: date-time, nullable: true }
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
 *                     data: { $ref: '#/components/schemas/Task' }
 *       403:
 *         description: Forbidden — not the owner/manager, or non-manager attempting reassignment
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/:id', ctrl.updateTask);
/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
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
router.delete('/:id', isSuperAdmin, ctrl.deleteTask);

module.exports = router;
