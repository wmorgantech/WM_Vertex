const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

const publicUser = (u) => {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
};

// GET /api/users  (list, filterable) — Admin/Super Admin only
async function listUsers(req, res) {
  const { role, departmentId, status, employmentType, search, page = 1, limit = 25 } = req.query;

  const where = {
    ...(role && { role }),
    ...(departmentId && { departmentId }),
    ...(status && { status }),
    ...(employmentType && { employmentType }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const skip = (Math.max(parseInt(page, 10), 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ]);

  return sendSuccess(res, 200, items.map(publicUser), { total, page: Number(page), limit: take });
}

// GET /api/users/:id
async function getUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      department: true,
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      directReports: { select: { id: true, firstName: true, lastName: true, role: true, designation: true } },
      internEnrollment: { include: { batch: true, mentor: { select: { id: true, firstName: true, lastName: true } } } },
      location: { select: { id: true, name: true } },
    },
  });
  if (!user) throw new ApiError(404, 'User not found');

  const isSelf = req.user.id === user.id;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!isSelf && !isManagerRole) throw new ApiError(403, 'Not authorized to view this profile');

  return sendSuccess(res, 200, publicUser(user));
}

// POST /api/users — create employee/intern (Admin/Super Admin)
async function createUser(req, res) {
  const {
    email, password, firstName, lastName, phone, role, designation,
    employmentType, departmentId, managerId, locationId, joinDate,
  } = req.body;

  if (!email || !password || !firstName || !lastName) {
    throw new ApiError(400, 'email, password, firstName and lastName are required');
  }

  if (req.user.role === 'ADMIN' && role === 'SUPER_ADMIN') {
    throw new ApiError(403, 'Admins cannot create Super Admin accounts');
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, 'A user with this email already exists');

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      firstName,
      lastName,
      phone,
      role: role || 'EMPLOYEE',
      designation: designation || null,
      employmentType: employmentType || (role === 'INTERN' ? 'INTERN' : role === 'TRAINEE' ? 'TRAINEE' : 'FULL_TIME'),
      departmentId: departmentId || null,
      managerId: managerId || null,
      locationId: locationId || null,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
    },
  });

  await recordAudit({
    actorId: req.user.id, action: 'CREATED', module: 'USER', entityId: user.id,
    entityLabel: `${user.firstName} ${user.lastName}`, after: publicUser(user),
  });

  return sendSuccess(res, 201, publicUser(user));
}

// PUT /api/users/:id
async function updateUser(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new ApiError(404, 'User not found');

  const isSelf = req.user.id === target.id;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!isSelf && !isManagerRole) throw new ApiError(403, 'Not authorized to update this profile');

  const allowedSelfFields = [
    'phone', 'avatarUrl', 'gender', 'dateOfBirth', 'address',
    'skills', 'technologyStack', 'certifications', 'experienceYears',
  ];
  const allowedManagerFields = [
    'firstName', 'lastName', 'email', 'phone', 'role', 'designation', 'employmentType',
    'status', 'departmentId', 'managerId', 'locationId', 'avatarUrl', 'exitDate', 'joinDate',
    'gender', 'dateOfBirth', 'address', 'skills', 'technologyStack', 'certifications', 'experienceYears',
    'mustChangePassword',
  ];

  const fields = isManagerRole ? allowedManagerFields : allowedSelfFields;
  const data = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  }
  if (data.exitDate) data.exitDate = new Date(data.exitDate);
  if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
  if (data.joinDate) data.joinDate = new Date(data.joinDate);

  if (data.email) {
    data.email = data.email.toLowerCase();
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail && existingEmail.id !== target.id) throw new ApiError(409, 'A user with this email already exists');
  }

  // Self changing their own password must re-prove they know the current one
  // (otherwise a stolen/idle session could silently take over the account);
  // a manager setting someone else's password via "Manage Account" has no
  // current password to prove and isn't asked for one. A successful
  // self-service change always satisfies any pending forced-change flag.
  if (req.body.password) {
    if (isSelf) {
      if (!req.body.currentPassword) throw new ApiError(400, 'Current password is required to change your password');
      const currentMatches = await bcrypt.compare(req.body.currentPassword, target.password);
      if (!currentMatches) throw new ApiError(401, 'Current password is incorrect');
      data.password = await bcrypt.hash(req.body.password, 10);
      data.mustChangePassword = false;
    } else if (isManagerRole) {
      data.password = await bcrypt.hash(req.body.password, 10);
    }
  }

  if (req.user.role === 'ADMIN' && (target.role === 'SUPER_ADMIN' || data.role === 'SUPER_ADMIN')) {
    throw new ApiError(403, 'Admins cannot modify Super Admin accounts');
  }

  const user = await prisma.user.update({ where: { id: target.id }, data });
  if (!isSelf) {
    await recordAudit({
      actorId: req.user.id, action: 'UPDATED', module: 'USER', entityId: user.id,
      entityLabel: `${user.firstName} ${user.lastName}`, before: publicUser(target), after: publicUser(user),
    });
  }
  return sendSuccess(res, 200, publicUser(user));
}

// DELETE /api/users/:id — soft delete (terminate) — Super Admin only
async function deactivateUser(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new ApiError(404, 'User not found');

  const user = await prisma.user.update({
    where: { id: target.id },
    data: { status: 'TERMINATED', exitDate: new Date() },
  });
  await recordAudit({
    actorId: req.user.id, action: 'DEACTIVATED', module: 'USER', entityId: user.id,
    entityLabel: `${user.firstName} ${user.lastName}`, before: publicUser(target), after: publicUser(user),
  });
  return sendSuccess(res, 200, publicUser(user));
}

// GET /api/users/:id/org-chart — hierarchy under a user
async function orgChart(req, res) {
  async function buildTree(userId) {
    const node = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, role: true, designation: true },
    });
    if (!node) return null;
    const reports = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    const children = await Promise.all(reports.map((r) => buildTree(r.id)));
    return { ...node, children: children.filter(Boolean) };
  }

  const tree = await buildTree(req.params.id);
  if (!tree) throw new ApiError(404, 'User not found');
  return sendSuccess(res, 200, tree);
}

module.exports = { listUsers, getUser, createUser, updateUser, deactivateUser, orgChart };
