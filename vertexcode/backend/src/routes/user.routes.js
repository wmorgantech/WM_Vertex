const router = require('express').Router();
const { body } = require('express-validator');
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const { can } = require('../middleware/permission');
const validate = require('../utils/validate');
const ctrl = require('../controllers/user.controller');

router.use(authenticate);

// Only validates the password-related fields — every other field on this
// large partial-update endpoint keeps its existing controller-level handling
// (see updateUser's allowedSelfFields/allowedManagerFields), not touched here.
const updateUserValidators = [
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('currentPassword').optional().isString(),
];

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: role
 *         in: query
 *         description: A single role, or a comma-separated list (e.g. "EMPLOYEE,ADMIN,SUPER_ADMIN")
 *         schema: { type: string }
 *       - name: departmentId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: designation
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         description: A single status, or a comma-separated list (e.g. "ACTIVE,TERMINATED")
 *         schema: { type: string }
 *       - name: employmentType
 *         in: query
 *         schema: { type: string }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 25, maximum: 100 }
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
 *                         items:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/User' }
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
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
router.get('/', can('user', 'view'), ctrl.listUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UserCreateRequest' }
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
 *                     data: { $ref: '#/components/schemas/User' }
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
 */
router.post('/', can('user', 'create'), ctrl.createUser);

/**
 * @swagger
 * /users/{id}/org-chart:
 *   get:
 *     tags: [Users]
 *     summary: Get the recursive org chart rooted at a user
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
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       description: Recursive org-chart node with nested directReports
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id/org-chart', ctrl.orgChart);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by id
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
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/User'
 *                         - type: object
 *                           description: Includes department, manager, and directReports
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id', ctrl.getUser);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user (also the password-change endpoint — self-service and admin/manager reset)
 *     description: >
 *       Self can only update a narrower subset (phone, avatarUrl, gender, dateOfBirth,
 *       address, skills, technologyStack, certifications, experienceYears, and their
 *       own password); managers/admins can update all fields listed below, including
 *       another user's password and their mustChangePassword flag.
 *
 *
 *       **Password change — self-service:** the caller updating their own account
 *       (`id` = caller's own id) and sending `password` must also send `currentPassword`;
 *       it's verified with bcrypt against the stored hash before the change is applied.
 *       A successful self-change always clears `mustChangePassword` to `false`, regardless
 *       of its previous value.
 *
 *
 *       **Password change — admin/manager reset:** a SUPER_ADMIN or ADMIN changing a
 *       *different* user's password sends only `password` — `currentPassword` is neither
 *       required nor checked. They may also set `mustChangePassword: true` in the same
 *       request to force that user to change their password again on next login (see the
 *       `mustChangePassword` field on the User schema); this is how the "Manage Account"
 *       temporary-password flow works. `mustChangePassword` is otherwise only ever cleared
 *       automatically, never set to `true` by a self-service change.
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
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email, description: 'Manager/admin only' }
 *               phone: { type: string }
 *               role: { type: string, enum: [SUPER_ADMIN, ADMIN, EMPLOYEE, INTERN, TRAINEE], description: 'Manager/admin only; an ADMIN cannot set or modify a SUPER_ADMIN account' }
 *               designation: { type: string }
 *               employmentType: { type: string }
 *               status: { type: string, enum: [ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, ALUMNI], description: 'Manager/admin only' }
 *               departmentId: { type: string, format: uuid }
 *               managerId: { type: string, format: uuid }
 *               locationId: { type: string, format: uuid }
 *               avatarUrl: { type: string }
 *               exitDate: { type: string, format: date, description: 'Manager/admin only' }
 *               joinDate: { type: string, format: date, description: 'Manager/admin only' }
 *               gender: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               address: { type: string }
 *               skills:
 *                 type: array
 *                 items: { type: string }
 *               technologyStack:
 *                 type: array
 *                 items: { type: string }
 *               certifications:
 *                 type: array
 *                 items: { type: string }
 *               experienceYears: { type: number }
 *               password: { type: string, format: password, minLength: 8, description: 'New password. Self-service requires currentPassword in the same request (see description above); an admin/manager setting a different user''s password does not.' }
 *               currentPassword: { type: string, format: password, description: 'Required only when the caller is changing their own password (self-service). Verified against the stored hash — 401 if it does not match.' }
 *               mustChangePassword: { type: boolean, description: 'Manager/admin only. Forces the target user to change their password on next login. Cleared automatically on a successful self-service change; cannot be set by a self-service request.' }
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
 *                     data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation error, or (self-service) `password` sent without `currentPassword`
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Missing/invalid access token, or (self-service password change) `currentPassword` does not match
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — editing a field outside the caller's allowed subset, or an ADMIN attempting to modify a SUPER_ADMIN account
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.put('/:id', updateUserValidators, validate, ctrl.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete (deactivate) a user
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
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Forbidden — Super Admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:id', isSuperAdmin, ctrl.deactivateUser);

module.exports = router;
