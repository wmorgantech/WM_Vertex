const router = require('express').Router();
const { body } = require('express-validator');
const authenticate = require('../middleware/auth');
const validate = require('../utils/validate');
const loginRateLimiter = require('../middleware/loginRateLimiter');
const ctrl = require('../controllers/auth.controller');

const loginValidators = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
const forgotPasswordValidators = [
  body('email').isEmail().withMessage('A valid email is required'),
];
const resetPasswordValidators = [
  body('token').notEmpty().withMessage('Token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: >
 *       Subject to a dedicated, stricter rate limit (10 requests per 15
 *       minutes per client IP) in addition to the global API rate limit.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LoginResponse' }
 *       400:
 *         description: Missing/invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Account is TERMINATED or SUSPENDED
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       429:
 *         description: Too many login attempts — rate limit exceeded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/login', loginRateLimiter, loginValidators, validate, ctrl.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
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
 *                         accessToken: { type: string }
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/refresh', ctrl.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and invalidate the refresh token
 *     security: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 */
router.post('/logout', ctrl.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
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
 *                         user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/me', authenticate, ctrl.me);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     description: >
 *       Always returns the same generic success message whether or not the
 *       email belongs to an account, and never sends anything for a
 *       TERMINATED or SUSPENDED account — this prevents an attacker from
 *       using this endpoint to discover which emails are registered.
 *       If eligible, emails a single-use reset link (valid 60 minutes) via
 *       the app's existing SMTP configuration. Requesting a new reset
 *       invalidates any previous unused reset token for the same account.
 *       Subject to the global API rate limit.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: you@yourcompany.com }
 *     responses:
 *       200:
 *         description: >
 *           Always returned on valid input, regardless of whether the email
 *           exists, is unregistered, or belongs to a TERMINATED/SUSPENDED account.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: 'If an account with that email exists, a password reset link has been sent.' }
 *       400:
 *         description: Missing or invalid email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       429:
 *         description: Too many requests — global API rate limit exceeded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/forgot-password', forgotPasswordValidators, validate, ctrl.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset a password using a token from the forgot-password email
 *     description: >
 *       The token is single-use and expires 60 minutes after it was issued;
 *       both an expired and an already-used token are rejected with the same
 *       generic 400 (no distinction is revealed). On success, clears any
 *       pending mustChangePassword flag (the same rule self-service password
 *       changes follow via PUT /users/{id}) and revokes all of the account's
 *       existing refresh tokens, signing out any other active sessions.
 *       Subject to the global API rate limit.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string, description: 'The raw token from the reset email link (not stored anywhere in hashed form until compared)' }
 *               password: { type: string, format: password, minLength: 8, description: 'New password, minimum 8 characters' }
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: 'Password has been reset successfully. Please log in with your new password.' }
 *       400:
 *         description: Missing fields, password too short, or the token is invalid/expired/already used
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: The account is TERMINATED or SUSPENDED
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       429:
 *         description: Too many requests — global API rate limit exceeded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/reset-password', resetPasswordValidators, validate, ctrl.resetPassword);

module.exports = router;
