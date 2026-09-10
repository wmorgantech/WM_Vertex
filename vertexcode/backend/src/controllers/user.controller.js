const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { computeEmployeeCode } = require('../utils/employeeCode');
const { parseCsvRecords } = require('../utils/csvParser');

const publicUser = (u) => {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
};

// GET /api/users  (list, filterable) — Admin/Super Admin only
async function listUsers(req, res) {
  const { role, departmentId, designation, status, employmentType, search, page = 1, limit = 25 } = req.query;

  // `role` accepts a single value or a comma-separated list (e.g. the
  // Employees page sends "EMPLOYEE,ADMIN,SUPER_ADMIN" to exclude interns/
  // trainees server-side instead of truncating a paginated page client-side).
  const roles = role ? role.split(',').map((r) => r.trim()).filter(Boolean) : null;
  // `status` mirrors the same pattern (e.g. "ACTIVE,TERMINATED" for the
  // Employees page's "All" status filter) so a multi-status view still gets
  // a real, correctly-scoped server-side count/pagination instead of either
  // an invalid single-value match or an unfiltered result set.
  const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) : null;

  const where = {
    ...(roles && roles.length && { role: roles.length === 1 ? roles[0] : { in: roles } }),
    ...(departmentId && { departmentId }),
    ...(designation && { designation }),
    ...(statuses && statuses.length && { status: statuses.length === 1 ? statuses[0] : { in: statuses } }),
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
  const withCode = items.map((u) => ({ ...publicUser(u), employeeCode: computeEmployeeCode(u.joinDate) }));

  return sendSuccess(res, 200, withCode, { total, page: Number(page), limit: take });
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

  return sendSuccess(res, 200, { ...publicUser(user), employeeCode: computeEmployeeCode(user.joinDate) });
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
  // Only a Super Admin may create an Admin account — otherwise any Admin
  // could mint a brand-new Admin peer, the same escalation updateUser
  // already blocks for promoting an *existing* user to Admin.
  if (req.user.role === 'ADMIN' && role === 'ADMIN') {
    throw new ApiError(403, 'Admins cannot create Admin accounts');
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

  return sendSuccess(res, 201, { ...publicUser(user), employeeCode: computeEmployeeCode(user.joinDate) });
}

// POST /api/users/import — bulk-create Employee/Admin accounts from a CSV
// file. Gated by the same can('user','create') permission as the
// single-record POST / above (see user.routes.js) — bulk import is not a
// separately-privileged capability, and the same Admin escalation rule
// (cannot create Admin/Super Admin accounts) applies per row.
//
// All-or-nothing: every row is validated up front against the master data
// (designations/departments/employment types) and existing emails; if ANY
// row fails, NOTHING is created and the full list of per-row errors is
// returned in the error response's `details.errors` — a partial import
// (some rows silently skipped) never happens.
//
// Expected header row (case-sensitive, extra/missing optional columns are
// fine): First Name, Last Name, Email, Phone, Designation, Department,
// Role, Employment Type, Join Date — mirrors GET /reports/employees'
// export column headers so an exported file can be edited and re-imported.
//
// Role also accepts TRAINEE — this endpoint doubles as the Trainee
// module's bulk-import (its "Create Trainee" step already reuses this same
// POST /users, see user.routes.js/createUser's role handling), so a single
// import surface covers both instead of a duplicate endpoint.
const IMPORT_MAX_ROWS = 500;
const IMPORT_ROLES = ['EMPLOYEE', 'ADMIN', 'TRAINEE'];

async function importEmployees(req, res) {
  if (!req.file) throw new ApiError(400, 'CSV file is required (form field "file")');

  const text = req.file.buffer.toString('utf-8');
  const records = parseCsvRecords(text);
  if (records.length === 0) throw new ApiError(400, 'CSV file has no data rows');
  if (records.length > IMPORT_MAX_ROWS) {
    throw new ApiError(400, `CSV file has ${records.length} rows — the maximum per import is ${IMPORT_MAX_ROWS}`);
  }

  // Optional multipart field (not a CSV column) — lets the Trainees page
  // upload a CSV with no "Role" column at all and have every row default to
  // TRAINEE, while the Employees page's default (no field sent) stays
  // EMPLOYEE exactly as before. A per-row "Role" column, if present, always
  // wins over this.
  const defaultRole = (req.body.defaultRole || 'EMPLOYEE').toUpperCase();
  if (!IMPORT_ROLES.includes(defaultRole)) {
    throw new ApiError(400, `defaultRole must be one of ${IMPORT_ROLES.join(', ')}`);
  }

  const [designations, departments, employmentTypes, existingUsers] = await Promise.all([
    prisma.designation.findMany({ select: { name: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.employmentType.findMany({ select: { code: true } }),
    prisma.user.findMany({ select: { email: true } }),
  ]);
  const designationNames = new Set(designations.map((d) => d.name));
  const departmentByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
  const employmentTypeCodes = new Set(employmentTypes.map((e) => e.code));
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  const field = (record, name) => record[name] ?? record[name.replace(/ /g, '')] ?? '';
  const seenEmails = new Set();
  const errors = [];
  const toCreate = [];

  records.forEach((record, idx) => {
    const rowNum = idx + 2; // +1 for 0-index, +1 for the header row
    const firstName = field(record, 'First Name');
    const lastName = field(record, 'Last Name');
    const email = field(record, 'Email').toLowerCase();
    const phone = field(record, 'Phone') || null;
    const designation = field(record, 'Designation');
    const departmentName = field(record, 'Department');
    const roleRaw = (field(record, 'Role') || defaultRole).toUpperCase();
    // Matches createUser's own role-aware default exactly (see
    // user.controller.js createUser) — a Trainee row with no Employment
    // Type column must default to TRAINEE, not FULL_TIME.
    const employmentType = field(record, 'Employment Type') || (roleRaw === 'TRAINEE' ? 'TRAINEE' : 'FULL_TIME');
    const joinDateRaw = field(record, 'Join Date');

    const rowErrors = [];
    if (!firstName) rowErrors.push('First Name is required');
    if (!lastName) rowErrors.push('Last Name is required');
    if (!email || !email.includes('@')) rowErrors.push('A valid Email is required');
    if (email) {
      if (existingEmails.has(email)) rowErrors.push(`Email "${email}" already exists`);
      if (seenEmails.has(email)) rowErrors.push(`Email "${email}" is duplicated within this file`);
      seenEmails.add(email);
    }
    if (!IMPORT_ROLES.includes(roleRaw)) {
      rowErrors.push(`Role must be one of ${IMPORT_ROLES.join(', ')}`);
    } else if (roleRaw === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      rowErrors.push('Only Super Admin can import Admin accounts');
    }
    if (designation && !designationNames.has(designation)) rowErrors.push(`Unknown designation "${designation}"`);
    let departmentId = null;
    if (departmentName) {
      departmentId = departmentByName.get(departmentName.toLowerCase()) || null;
      if (!departmentId) rowErrors.push(`Unknown department "${departmentName}"`);
    }
    if (employmentType && !employmentTypeCodes.has(employmentType)) rowErrors.push(`Unknown employment type "${employmentType}"`);
    let joinDate = new Date();
    if (joinDateRaw) {
      joinDate = new Date(joinDateRaw);
      if (Number.isNaN(joinDate.getTime())) rowErrors.push(`Invalid Join Date "${joinDateRaw}"`);
    }

    if (rowErrors.length) {
      errors.push({ row: rowNum, email: email || null, errors: rowErrors });
      return;
    }

    toCreate.push({
      email, firstName, lastName, phone, role: roleRaw,
      designation: designation || null, departmentId, employmentType, joinDate,
    });
  });

  if (errors.length) {
    throw new ApiError(400, `${errors.length} of ${records.length} row(s) failed validation — nothing was imported`, { errors });
  }

  // A random temporary password per row — never read from the file (the
  // file could be emailed/shared and shouldn't carry credentials) and never
  // returned in the response. mustChangePassword forces the imported
  // account to set its own password via the existing "Manage Account" reset
  // flow before it can be used, exactly like a freshly-created account today.
  const hashedRows = await Promise.all(toCreate.map(async (r) => ({
    ...r, password: await bcrypt.hash(crypto.randomBytes(18).toString('base64url'), 10),
  })));

  const created = await prisma.$transaction(
    hashedRows.map((r) => prisma.user.create({
      data: {
        email: r.email, password: r.password, firstName: r.firstName, lastName: r.lastName,
        phone: r.phone, role: r.role, designation: r.designation, departmentId: r.departmentId,
        employmentType: r.employmentType, joinDate: r.joinDate, mustChangePassword: true,
      },
    }))
  );

  await recordAudit({
    actorId: req.user.id, action: 'IMPORTED', module: 'USER', entityId: 'bulk',
    entityLabel: `${created.length} account(s) imported from CSV`, after: { count: created.length, emails: created.map((u) => u.email) },
  });

  return sendSuccess(res, 201, {
    imported: created.length,
    message: `${created.length} account(s) imported. Each must reset their password via Manage Account before they can log in.`,
  });
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
  // Only a Super Admin may grant the Admin role itself — otherwise any Admin
  // could promote an arbitrary user to their own privilege level.
  if (req.user.role === 'ADMIN' && data.role === 'ADMIN') {
    throw new ApiError(403, 'Admins cannot assign the Admin role');
  }
  // Soft-delete/deactivate (status -> SUSPENDED or TERMINATED) on someone
  // else's account is Super-Admin-only, matching the dedicated soft-delete
  // endpoint's own gate below — an Admin may still set other status values
  // (e.g. ON_LEAVE, or ACTIVE to restore) on accounts they manage.
  if (req.user.role === 'ADMIN' && !isSelf && ['SUSPENDED', 'TERMINATED'].includes(data.status)) {
    throw new ApiError(403, 'Only a Super Admin can deactivate or remove an employee');
  }

  const user = await prisma.user.update({ where: { id: target.id }, data });
  if (!isSelf) {
    await recordAudit({
      actorId: req.user.id, action: 'UPDATED', module: 'USER', entityId: user.id,
      entityLabel: `${user.firstName} ${user.lastName}`, before: publicUser(target), after: publicUser(user),
    });
  }
  return sendSuccess(res, 200, { ...publicUser(user), employeeCode: computeEmployeeCode(user.joinDate) });
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

// DELETE /api/users/:id/permanent — Super Admin only. Irreversible:
// permanently deletes the entire User account. Cascades every row that owns
// a foreign key to this user (LeaveRequest, Attendance, Notification,
// InternEnrollment, ProjectMember, Timesheet, DailyWorkUpdate,
// TraineeEnrollment — all onDelete: Cascade, see schema.prisma). Any
// non-cascade reference elsewhere (e.g. this user as a Task's creator, a
// Timesheet's approver, another user's manager, a Department's head) blocks
// the delete with a foreign-key constraint error instead of silently
// discarding it — the existing global error handler (errorHandler.js)
// already converts that into a clean 409 "Related record constraint
// violation" response, so no extra handling is needed here. Requires the
// account already be in Trash — same two-step safety as every other
// permanent-delete in this app (documents, interns): Move to Trash first,
// this is always a separate, explicit second action.
async function permanentlyDeleteUser(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new ApiError(404, 'User not found');
  if (target.status !== 'TERMINATED') {
    throw new ApiError(400, 'Only accounts already in Trash can be permanently deleted');
  }

  await prisma.user.delete({ where: { id: target.id } });

  await recordAudit({
    actorId: req.user.id, action: 'PERMANENTLY_DELETED', module: 'USER', entityId: target.id,
    entityLabel: `${target.firstName} ${target.lastName}`, before: publicUser(target),
  });

  return sendSuccess(res, 200, { message: 'User permanently deleted' });
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

module.exports = { listUsers, getUser, createUser, importEmployees, updateUser, deactivateUser, permanentlyDeleteUser, orgChart };
