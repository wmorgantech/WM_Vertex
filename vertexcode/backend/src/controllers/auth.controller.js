const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshExpiryDate,
} = require('../utils/jwt');
const { generateResetToken, hashResetToken } = require('../utils/passwordResetToken');
const { sendMail, renderEmailTemplate } = require('../services/email.service');

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  designation: u.designation,
  employmentType: u.employmentType,
  status: u.status,
  departmentId: u.departmentId,
  managerId: u.managerId,
  avatarUrl: u.avatarUrl,
  joinDate: u.joinDate,
  mustChangePassword: u.mustChangePassword,
});

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new ApiError(401, 'Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new ApiError(401, 'Invalid credentials');

  if (user.status === 'TERMINATED' || user.status === 'SUSPENDED') {
    throw new ApiError(403, 'Account is not active. Contact your administrator.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiryDate() },
  });

  return sendSuccess(res, 200, { user: publicUser(user), accessToken, refreshToken });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, 'Refresh token is required');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token is no longer valid');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new ApiError(401, 'User no longer exists');

  const accessToken = signAccessToken(user);
  return sendSuccess(res, 200, { accessToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  }
  return sendSuccess(res, 200, { message: 'Logged out' });
}

async function me(req, res) {
  return sendSuccess(res, 200, { user: publicUser(req.user) });
}

// POST /api/auth/forgot-password — always responds the same way whether or
// not the email belongs to an account (no enumeration). Silently skips
// sending anything for TERMINATED/SUSPENDED accounts, matching login()'s own
// status rule, without ever revealing that distinction in the response.
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email is required');

  const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status === 'TERMINATED' || user.status === 'SUSPENDED') {
    return sendSuccess(res, 200, genericResponse);
  }

  // Only the most recently requested token should be usable at a time.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const { token, tokenHash, expiresAt } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your VertexWM password',
    html: renderEmailTemplate('passwordReset.html', {
      firstName: user.firstName,
      resetLink,
      expiresInMinutes: 60,
    }),
  });

  return sendSuccess(res, 200, genericResponse);
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) throw new ApiError(400, 'Token and new password are required');

  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });
  if (!user) throw new ApiError(400, 'Invalid or expired reset token');
  if (user.status === 'TERMINATED' || user.status === 'SUSPENDED') {
    throw new ApiError(403, 'Account is not active. Contact your administrator.');
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
    // A password reset is a recovery action for a potentially compromised
    // account — any existing sessions (refresh tokens) issued under the old
    // password should not silently continue to work.
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    }),
  ]);

  return sendSuccess(res, 200, { message: 'Password has been reset successfully. Please log in with your new password.' });
}

module.exports = { login, refresh, logout, me, forgotPassword, resetPassword };
