const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { sendMail, renderEmailTemplate } = require('../services/email.service');
const { renderHtmlToPdf, renderPdfTemplate } = require('../services/pdf.service');
const { generateQrDataUrl } = require('../utils/qrCode');
const { recordAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { evaluateRequiredDocs } = require('../utils/internDocumentRequirements');
const { computeEmployeeCode } = require('../utils/employeeCode');

const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'Job Oriented Training (JOT)' };

// Fixed per company policy (not per-intern data) — same for every offer
// letter, matching the master template's Work Schedule/Working Hours clauses.
const OFFER_LETTER_WORKING_HOURS = '10:00 AM – 7:00 PM';
const OFFER_LETTER_WORKING_DAYS = 'Monday to Saturday';
const OFFER_LETTER_HR_EMAIL = 'hr@wmorgantech.com';

function ordinalSuffix(day) {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}
// "22nd August 2026" — matches the master template's date style exactly.
function formatOrdinalDate(date) {
  const d = new Date(date);
  const day = d.getDate();
  return `${day}${ordinalSuffix(day)} ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
}
// Whole-month difference (e.g. "2 Months"), falling back to whole days for
// a tenure shorter than one month.
function computeTenureText(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1;
  months = Math.max(months, 0);
  if (months < 1) {
    const days = Math.max(Math.round((e - s) / 86400000), 1);
    return `${days} Day${days === 1 ? '' : 's'}`;
  }
  return `${months} Month${months === 1 ? '' : 's'}`;
}

// Company identity + signatory block for generated PDFs, configurable by
// Super Admin (see settings.controller.js) rather than hardcoded per template.
async function getBrandTemplateVars() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const companyName = settings?.companyName || 'VertexWM';
  const brandMarkHtml = settings?.companyLogoUrl
    ? `<img src="${settings.companyLogoUrl}" alt="${companyName}" style="height:34px;max-width:120px;object-fit:contain;" />`
    : `<div class="brand-mark">${companyName.slice(0, 2).toUpperCase()}</div>`;
  return {
    companyName,
    companyNameUpper: companyName.toUpperCase(),
    companyAddress: settings?.companyAddress || '',
    signatoryName: settings?.signatoryName || 'Authorized Signatory',
    signatoryTitle: settings?.signatoryTitle || 'Management',
    brandMarkHtml,
  };
}

const OFFER_LETTER_DIR = path.join(__dirname, '../../uploads/offer-letters');
const CERTIFICATE_DIR = path.join(__dirname, '../../uploads/certificates');
fs.mkdirSync(OFFER_LETTER_DIR, { recursive: true });
fs.mkdirSync(CERTIFICATE_DIR, { recursive: true });

// --- Intern Profiles ---------------------------------------------------------
// Creating an intern PROFILE is deliberately separate from enrolling them in
// a batch (see enrollIntern below) — an intern can exist in the system before
// ever being assigned to a batch. No InternEnrollment row is created here.

// POST /api/interns — create an intern profile only (Admin/Super Admin, or a
// Senior Full Stack Developer employee — see canAddIntern in intern.routes.js)
async function createIntern(req, res) {
  const { email, password, firstName, lastName, phone, designation, departmentId, managerId, locationId, joinDate } = req.body;

  if (!email || !password || !firstName || !lastName) {
    throw new ApiError(400, 'email, password, firstName and lastName are required');
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, 'A user with this email already exists');

  // designation is a foreign key to Designation.name (schema.prisma), not a
  // free-text label — an unrecognized value would otherwise reach Prisma
  // and surface as a raw P2003 ("Related record constraint violation")
  // instead of a clear, actionable message.
  if (designation) {
    const designationRow = await prisma.designation.findUnique({ where: { name: designation } });
    if (!designationRow) throw new ApiError(400, `Unknown designation: "${designation}". It must match an existing designation exactly.`);
  }

  const hashed = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        firstName,
        lastName,
        phone,
        role: 'INTERN',
        employmentType: 'INTERN',
        designation: designation || null,
        departmentId: departmentId || null,
        managerId: managerId || null,
        locationId: locationId || null,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
      },
    });
  } catch (err) {
    // The findUnique check above has a narrow race window (two submissions
    // for the same brand-new email landing at nearly the same instant) —
    // without this, the loser would surface a raw Prisma P2002 ("Duplicate
    // value for field(s): email") instead of the same clear message the
    // upfront check gives everyone else.
    if (err.code === 'P2002') throw new ApiError(409, 'A user with this email already exists');
    throw err;
  }

  const { password: _pw, ...safeUser } = user;
  await recordAudit({
    actorId: req.user.id, action: 'CREATED', module: 'INTERN', entityId: user.id,
    entityLabel: `${user.firstName} ${user.lastName}`, after: safeUser,
  });

  return sendSuccess(res, 201, safeUser);
}

// --- Batches ---------------------------------------------------------------

async function listBatches(req, res) {
  const batches = await prisma.internshipBatch.findMany({
    include: { _count: { select: { enrollments: true } } },
    orderBy: { startDate: 'desc' },
  });
  return sendSuccess(res, 200, batches);
}

async function getBatch(req, res) {
  const batch = await prisma.internshipBatch.findUnique({
    where: { id: req.params.id },
    include: {
      enrollments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
          mentor: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!batch) throw new ApiError(404, 'Batch not found');
  return sendSuccess(res, 200, batch);
}

async function createBatch(req, res) {
  const { name, program, startDate, endDate, description, status } = req.body;
  if (!name || !program || !startDate || !endDate) {
    throw new ApiError(400, 'name, program, startDate and endDate are required');
  }
  const batch = await prisma.internshipBatch.create({
    data: {
      name,
      program,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      description,
      status: status || 'UPCOMING',
    },
  });
  return sendSuccess(res, 201, batch);
}

async function updateBatch(req, res) {
  const { name, program, startDate, endDate, description, status } = req.body;
  const batch = await prisma.internshipBatch.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(program && { program }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
    },
  });
  return sendSuccess(res, 200, batch);
}

async function deleteBatch(req, res) {
  await prisma.internshipBatch.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Batch removed' });
}

// GET /api/interns/enrollable-users — minimal user list for the "Enroll to
// Batch" picker: existing intern profiles (role=INTERN) not yet enrolled in
// any batch. Deliberately narrower than GET /users (which requires the
// broader user:view permission) so a Senior Full Stack Developer can enroll
// interns without being handed full HR visibility over every account.
async function listEnrollableUsers(req, res) {
  const enrolledUserIds = (await prisma.internEnrollment.findMany({ select: { userId: true } })).map((e) => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { notIn: enrolledUserIds }, role: 'INTERN' },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: { firstName: 'asc' },
  });
  return sendSuccess(res, 200, users);
}

// --- Enrollments -------------------------------------------------------------

// `accountStatus` (User.status, e.g. "ACTIVE" or "TERMINATED") is the
// Active/Inactive-vs-Trash axis; `completionStatus` (program progress) is
// the separate Active-vs-Inactive axis within non-deleted interns — see the
// frontend's viewTab derivation in Interns.jsx for how the two combine into
// Active/Inactive/All/Trash. Both accept a comma-separated list, mirroring
// the existing `role`/`status` convention on GET /users.
function toList(value) {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : null;
}

async function listEnrollments(req, res) {
  const { batchId, mentorId, completionStatus, accountStatus, search, page, limit } = req.query;
  const completionStatuses = toList(completionStatus);
  const accountStatuses = toList(accountStatus);

  // Search (on the related user) and accountStatus (also on the related
  // user) must be merged into ONE `user: {...}` clause — two separate
  // `user: {...}` filters spread into the same where-object would collide
  // under object spread (only the last `user` key survives), silently
  // dropping one of the two conditions.
  const userClause = {};
  if (search) {
    userClause.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  userClause.role = 'INTERN';
  if (accountStatuses && accountStatuses.length) {
    userClause.status = accountStatuses.length === 1 ? accountStatuses[0] : { in: accountStatuses };
  }
  const hasUserClause = Object.keys(userClause).length > 0;
  const completionStatusClause = completionStatuses && completionStatuses.length
    ? { completionStatus: completionStatuses.length === 1 ? completionStatuses[0] : { in: completionStatuses } }
    : null;

  // SUPER_ADMIN: unrestricted. Everyone else: interns they mentor (includes
  // Admins, and any employee who added an intern and defaulted to mentoring
  // them — see enrollIntern) plus their own enrollment if they have one.
  let where;
  if (req.user.role === 'SUPER_ADMIN') {
    where = {
      ...(batchId && { batchId }),
      ...(mentorId && { mentorId }),
      ...(completionStatusClause && completionStatusClause),
      ...(hasUserClause && { user: userClause }),
    };
  } else {
    // The owner-scoping OR and the other filters must stay in separate AND
    // entries — merging them into one OR array would let a matching search
    // term alone satisfy the filter, bypassing ownership.
    where = {
      AND: [
        { OR: [{ mentorId: req.user.id }, { userId: req.user.id }] },
        ...(batchId ? [{ batchId }] : []),
        ...(completionStatusClause ? [completionStatusClause] : []),
        ...(hasUserClause ? [{ user: userClause }] : []),
      ],
    };
  }

  // Pagination is opt-in — other callers (e.g. the intern's own dashboard)
  // rely on this endpoint returning their full, unbounded result set, so a
  // request with no page/limit keeps returning exactly what it does today.
  const paginate = page !== undefined || limit !== undefined;
  const take = paginate ? Math.min(parseInt(limit, 10) || 25, 100) : undefined;
  const currentPage = paginate ? Math.max(parseInt(page, 10) || 1, 1) : undefined;
  const skip = paginate ? (currentPage - 1) * take : undefined;

  const [enrollments, total] = await Promise.all([
    prisma.internEnrollment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, joinDate: true, exitDate: true } },
        batch: true,
        mentor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(paginate && { take, skip }),
    }),
    paginate ? prisma.internEnrollment.count({ where }) : Promise.resolve(undefined),
  ]);

  // employeeCode is a display-only derived value (see utils/employeeCode.js)
  // — same convention the Employees list already uses, reused as-is so the
  // Intern list's new ID column shows the same kind of identifier.
  const withCode = enrollments.map((e) => ({ ...e, user: { ...e.user, employeeCode: computeEmployeeCode(e.user.joinDate) } }));

  return sendSuccess(res, 200, withCode, paginate ? { total, page: currentPage, limit: take } : undefined);
}

// POST /api/interns/enrollments — enroll an EXISTING intern profile into a
// batch. The intern profile must already exist (see createIntern above); this
// never creates or modifies a User row, only the enrollment linking them to
// a batch.
async function enrollIntern(req, res) {
  const { userId, batchId, mentorId, stipend, notes, category } = req.body;
  if (!userId || !batchId) throw new ApiError(400, 'userId and batchId are required');
  if (category && !['FREE_INTERNSHIP', 'JOT'].includes(category)) {
    throw new ApiError(400, 'category must be FREE_INTERNSHIP or JOT');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found');
  if (user.role !== 'INTERN') {
    throw new ApiError(400, 'This user does not have an intern profile — create one first');
  }

  const batch = await prisma.internshipBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new ApiError(404, 'Batch not found');

  const existingEnrollment = await prisma.internEnrollment.findUnique({ where: { userId } });
  if (existingEnrollment) throw new ApiError(409, 'This intern is already enrolled in a batch');

  // Whoever enrolls an intern without naming a mentor becomes the default
  // mentor, so they keep visibility of the record they just created
  // (SUPER_ADMIN sees everything regardless, so this only matters for
  // Admins/Employees enrolling).
  const effectiveMentorId = mentorId || (req.user.role !== 'SUPER_ADMIN' ? req.user.id : null);

  const enrollment = await prisma.internEnrollment.create({
    data: { userId, batchId, mentorId: effectiveMentorId, stipend, notes, category: category || null },
  });
  await recordAudit({
    actorId: req.user.id, action: 'CREATED', module: 'INTERN_ENROLLMENT', entityId: enrollment.id,
    entityLabel: `${user.firstName} ${user.lastName}`, after: enrollment,
  });

  return sendSuccess(res, 201, enrollment);
}

async function updateEnrollment(req, res) {
  const { mentorId, completionStatus, performanceRating, progressPercent, stipend, notes, category } = req.body;
  if (category && !['FREE_INTERNSHIP', 'JOT'].includes(category)) {
    throw new ApiError(400, 'category must be FREE_INTERNSHIP or JOT');
  }
  // TERMINATED is reserved for the dedicated delete/restore flow below,
  // which keeps completionStatus and the linked User.status in sync (see
  // deleteEnrollment/restoreEnrollment). Allowing it here would let an
  // enrollment end up "TERMINATED" while the account stays ACTIVE — the
  // exact Active-list/Trash inconsistency this endpoint must not produce.
  if (completionStatus === 'TERMINATED') {
    throw new ApiError(400, 'Use DELETE /interns/enrollments/:id to remove an intern — completionStatus cannot be set to TERMINATED directly');
  }

  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  // Route-level can('intern','manage') only checks whether this ADMIN's
  // role is allowed to manage interns at all; this checks whether they may
  // manage THIS specific intern (mentor-scoped), matching the same rule
  // already enforced for GET /enrollments and the offer-letter lifecycle
  // actions (assertCanManageLifecycle).
  assertCanManageLifecycle(req, enrollment);

  const updated = await prisma.internEnrollment.update({
    where: { id: req.params.id },
    data: {
      ...(mentorId !== undefined && { mentorId }),
      ...(completionStatus && { completionStatus }),
      ...(performanceRating !== undefined && { performanceRating }),
      ...(progressPercent !== undefined && { progressPercent }),
      ...(stipend !== undefined && { stipend }),
      ...(notes !== undefined && { notes }),
      ...(category !== undefined && { category: category || null }),
    },
  });

  if (category) {
    await prisma.internshipAudit.create({
      data: { enrollmentId: req.params.id, action: 'CATEGORY_SET', actorId: req.user.id, metadata: category },
    });
  }

  if (completionStatus === 'CONVERTED_TO_EMPLOYEE') {
    await prisma.user.update({ where: { id: enrollment.userId }, data: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' } });
  }

  return sendSuccess(res, 200, updated);
}

// DELETE /api/interns/enrollments/:id — gated by intern:manage (Super Admin
// or Admin, see intern.routes.js) plus per-record mentor-scoping (Admins can
// only delete interns assigned to them — same rule as Edit and the
// offer-letter lifecycle actions). Soft delete only: the record is kept
// (completionStatus -> TERMINATED) for audit/history and the intern's
// account is deactivated, rather than removing any rows. This is the ONLY
// path that should ever set completionStatus to TERMINATED — see
// updateEnrollment's guard and restoreEnrollment below.
async function deleteEnrollment(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertCanManageLifecycle(req, enrollment);

  const updated = await prisma.internEnrollment.update({
    where: { id: req.params.id },
    data: { completionStatus: 'TERMINATED' },
  });
  await prisma.user.update({
    where: { id: enrollment.userId },
    data: { status: 'TERMINATED', exitDate: new Date() },
  });

  await recordAudit({
    actorId: req.user.id, action: 'DELETED', module: 'INTERN_ENROLLMENT', entityId: enrollment.id,
    entityLabel: `${enrollment.user.firstName} ${enrollment.user.lastName}`, before: enrollment, after: updated,
  });

  return sendSuccess(res, 200, { message: 'Intern removed' });
}

// POST /api/interns/enrollments/:id/restore — reverses deleteEnrollment:
// completionStatus back to IN_PROGRESS and the account reactivated. Same
// authorization as delete (intern:manage + mentor-scoping), so an Admin can
// only restore interns assigned to them; Super Admin unrestricted.
async function restoreEnrollment(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true, status: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertCanManageLifecycle(req, enrollment);

  // Defense in depth: an enrollment's user is always role=INTERN by
  // construction (enrollIntern rejects any other role), but this guards
  // against ever reactivating/promoting an unrelated account through this
  // endpoint if that invariant is ever broken elsewhere.
  if (enrollment.user.role !== 'INTERN') {
    throw new ApiError(400, 'This record does not belong to an intern account');
  }
  if (enrollment.completionStatus !== 'TERMINATED' && enrollment.user.status !== 'TERMINATED') {
    throw new ApiError(400, 'This intern is not in Trash');
  }

  const updated = await prisma.internEnrollment.update({
    where: { id: req.params.id },
    data: { completionStatus: 'IN_PROGRESS' },
  });
  await prisma.user.update({
    where: { id: enrollment.userId },
    data: { status: 'ACTIVE', exitDate: null },
  });

  await recordAudit({
    actorId: req.user.id, action: 'RESTORED', module: 'INTERN_ENROLLMENT', entityId: enrollment.id,
    entityLabel: `${enrollment.user.firstName} ${enrollment.user.lastName}`, before: enrollment, after: updated,
  });

  return sendSuccess(res, 200, { message: 'Intern restored' });
}

// DELETE /api/interns/enrollments/:id/permanent — Super Admin only.
// Irreversible: permanently deletes the intern's entire User account, not
// just the enrollment — cascades InternEnrollment and everything under it
// (InternDocument, OfferLetter, CompletionCertificate, InternshipAudit),
// plus the account's own Attendance/Timesheet/LeaveRequest/Notification/
// ProjectMember rows (all onDelete: Cascade on User in schema.prisma, the
// same mechanism already verified/used for the earlier Paintamil account
// cleanup). Requires the enrollment already be in Trash — same two-step
// safety as document permanent-delete (document.controller.js): Move to
// Trash first, this is always a separate, explicit second action.
async function permanentlyDeleteEnrollment(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, status: true } },
      documents: { select: { filePath: true } },
      offerLetter: { select: { filePath: true } },
      certificate: { select: { filePath: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  if (enrollment.completionStatus !== 'TERMINATED' && enrollment.user.status !== 'TERMINATED') {
    throw new ApiError(400, 'Only interns already in Trash can be permanently deleted');
  }

  const filesToRemove = [
    ...enrollment.documents.map((d) => d.filePath),
    ...(enrollment.offerLetter ? [enrollment.offerLetter.filePath] : []),
    ...(enrollment.certificate ? [enrollment.certificate.filePath] : []),
  ];

  await prisma.user.delete({ where: { id: enrollment.user.id } });

  // Every document/intern-specific audit trail (InternshipAudit,
  // InternDocumentAudit) cascade-deletes with the account — recorded here in
  // the generic AuditLog instead (a separate table, entityId is a plain
  // string, not an FK), so this is the durable record that survives it.
  await recordAudit({
    actorId: req.user.id, action: 'PERMANENTLY_DELETED', module: 'INTERN_ENROLLMENT', entityId: enrollment.id,
    entityLabel: `${enrollment.user.firstName} ${enrollment.user.lastName}`, before: enrollment,
  });

  filesToRemove.forEach((p) => { if (p) fs.unlink(p, () => {}); });

  return sendSuccess(res, 200, { message: 'Intern permanently deleted' });
}

// PUT /api/interns/enrollments/me — Intern self-service academic profile update
const PROFILE_FIELDS = [
  'collegeName', 'university', 'collegeDepartment', 'course', 'branch', 'year', 'semester',
  'registerNumber', 'collegeEmail', 'hodName', 'internshipStartDate', 'internshipEndDate',
];

async function updateMyEnrollment(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({ where: { userId: req.user.id } });
  if (!enrollment) throw new ApiError(404, 'No internship enrollment found. Contact an admin to be enrolled in a batch.');

  const data = {};
  for (const f of PROFILE_FIELDS) {
    if (req.body[f] === undefined) continue;
    if (['internshipStartDate', 'internshipEndDate'].includes(f)) {
      data[f] = req.body[f] ? new Date(req.body[f]) : null;
    } else if (['year', 'semester'].includes(f)) {
      data[f] = req.body[f] === '' || req.body[f] === null ? null : parseInt(req.body[f], 10);
    } else {
      data[f] = req.body[f];
    }
  }

  const updated = await prisma.internEnrollment.update({ where: { userId: req.user.id }, data });
  return sendSuccess(res, 200, updated);
}

// --- Internship Lifecycle: Final Approval, Offer Letter, Completion Certificate ---

function assertAdminOrOwnerAccess(req, enrollment) {
  if (req.user.role === 'SUPER_ADMIN') return;
  if (req.user.role === 'ADMIN') {
    if (enrollment.mentorId !== req.user.id) {
      throw new ApiError(403, 'You can only access interns assigned to you');
    }
    return;
  }
  if (req.user.role === 'INTERN' && enrollment.userId === req.user.id) return;
  throw new ApiError(403, 'You do not have permission to access this record');
}

// SUPER_ADMIN: unrestricted. ADMIN: only for interns they mentor — the same
// scoping already enforced everywhere else in this review flow (see
// getEnrollmentDetail/listAll in document.controller.js and
// assertAdminOwnsDocument there, and assertAdminOrOwnerAccess above).
// EMPLOYEE/INTERN can never approve or enable an offer letter.
function assertCanManageLifecycle(req, enrollment) {
  if (req.user.role === 'SUPER_ADMIN') return;
  if (req.user.role === 'ADMIN' && enrollment.mentorId === req.user.id) return;
  throw new ApiError(403, 'You can only manage interns assigned to you');
}

// POST /api/interns/enrollments/:id/approve — Super Admin, or the intern's
// mentoring Admin, gives final approval. This ONLY marks the enrollment
// approved and sends the existing general "Internship Approved" notification.
// It must NOT generate or email the offer letter — that is the separate,
// explicit "Enable Offer Letter" action below, triggered only by an admin
// clicking it.
async function finalApprove(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: {
      documents: true,
      user: { select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } } },
      batch: true,
      mentor: { select: { firstName: true, lastName: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertCanManageLifecycle(req, enrollment);

  // Approval is a one-time event — re-running it must neither move
  // finalApprovedAt nor re-send the "Internship Approved" email.
  if (enrollment.finalApprovedAt) {
    throw new ApiError(409, 'This enrollment has already received final approval');
  }

  const requirement = evaluateRequiredDocs(enrollment.documents);
  if (!requirement.satisfied) {
    const missing = requirement.groups.filter((g) => g.status !== 'VERIFIED').map((g) => g.label);
    throw new ApiError(400, `Required documents must be verified before final approval: ${missing.join(', ')}`);
  }

  const updated = await prisma.internEnrollment.update({
    where: { id: req.params.id },
    data: { finalApprovedAt: new Date(), finalApprovedById: req.user.id },
  });

  await prisma.internshipAudit.create({
    data: { enrollmentId: enrollment.id, action: 'FINAL_APPROVED', actorId: req.user.id },
  });

  // No email is sent here, by explicit requirement: approval must be silent.
  // (This previously sent an "Internship Has Been Approved" notification —
  // internshipApproved.html is kept on disk, unused, in case that separate
  // notification is wanted back; only its call site was removed.) The
  // intern is only ever emailed once the offer letter is enabled, below.

  return sendSuccess(res, 200, updated);
}

// Renders the offer-letter PDF for an enrollment using the W Morgan
// Technologies master template (backend/src/templates/pdf/offerLetter.html
// — an exact recreation of the company's official offer letter, not the
// generic template used by completionCertificate.html). Pure rendering —
// no DB writes, no email. Used by enableOfferLetter below.
async function renderOfferLetterPdf(enrollment) {
  const { companyName, signatoryName, signatoryTitle } = await getBrandTemplateVars();
  const { internshipStartDate: startDate, internshipEndDate: endDate } = enrollment;

  const html = renderPdfTemplate('offerLetter.html', {
    companyName,
    companyEmail: OFFER_LETTER_HR_EMAIL,
    candidateName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
    firstName: enrollment.user.firstName,
    qualificationLine: [enrollment.course, enrollment.branch].filter(Boolean).join(' - ') || '—',
    collegeName: enrollment.collegeName || '—',
    universityLine: enrollment.university || '—',
    domainTeam: enrollment.batch.name,
    joiningDateFormatted: startDate ? formatOrdinalDate(startDate) : '—',
    endDateFormatted: endDate ? formatOrdinalDate(endDate) : '—',
    tenureText: startDate && endDate ? computeTenureText(startDate, endDate) : '—',
    workingHours: OFFER_LETTER_WORKING_HOURS,
    workingDays: OFFER_LETTER_WORKING_DAYS,
    supervisorName: enrollment.mentor ? `${enrollment.mentor.firstName} ${enrollment.mentor.lastName}` : 'your assigned supervisor',
    signatoryName,
    signatoryTitle,
  });

  // The logo header and address/contact footer repeat on every page via
  // Puppeteer's native header/footer templates (a separate rendering
  // context from the body) — matching the master .docx, whose header/footer
  // repeat on both of its pages the same way.
  const headerTemplate = fs.readFileSync(path.join(__dirname, '../templates/pdf/offerLetterHeader.html'), 'utf8');
  const footerTemplate = fs.readFileSync(path.join(__dirname, '../templates/pdf/offerLetterFooter.html'), 'utf8');
  return renderHtmlToPdf(html, {
    headerTemplate,
    footerTemplate,
    margin: { top: '28mm', bottom: '20mm', left: '25.4mm', right: '25.4mm' },
  });
}

// "Internship Profile Approved & Offer Letter Available" email — sent once
// when the offer letter is first enabled, and again (identical content) on
// an explicit admin-triggered resend.
// Returns true/false (sendMail itself never throws) so callers that need to
// report the outcome — enableOfferLetter's emailSent flag, resendOfferLetterEmail's
// response — reflect what actually happened rather than assuming success.
async function sendOfferLetterAvailableEmail(enrollment, pdfBuffer, fileName) {
  const joiningDate = enrollment.internshipStartDate ? formatOrdinalDate(enrollment.internshipStartDate) : '—';
  const duration = (enrollment.internshipStartDate && enrollment.internshipEndDate)
    ? computeTenureText(enrollment.internshipStartDate, enrollment.internshipEndDate)
    : '—';
  return sendMail({
    to: enrollment.user.email,
    subject: 'Internship Profile Approved & Offer Letter Available – WMorgan Technologies',
    html: renderEmailTemplate('offerLetterAvailable.html', {
      internName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
      domain: enrollment.batch.name,
      joiningDate,
      duration,
      appUrl: process.env.APP_URL,
    }),
    attachments: [{ filename: fileName, content: pdfBuffer }],
  });
}

// POST /api/interns/enrollments/:id/offer-letter/enable — Super Admin, or
// the intern's mentoring Admin, explicitly enables the offer letter. This is
// the ONLY action that generates the PDF and emails the intern — approval
// alone (finalApprove above) does neither. Idempotent: calling it again once
// already enabled just returns the existing one, generating no second PDF
// and sending no second email (see resendOfferLetterEmail for an explicit,
// intentional re-send).
async function enableOfferLetter(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      batch: true,
      mentor: { select: { firstName: true, lastName: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertCanManageLifecycle(req, enrollment);
  if (!enrollment.finalApprovedAt) {
    throw new ApiError(400, 'The internship profile must be approved before the offer letter can be enabled');
  }

  const existing = await prisma.offerLetter.findUnique({ where: { enrollmentId: enrollment.id } });
  if (existing) {
    return sendSuccess(res, 200, existing);
  }

  // Rendered before any DB row is written or email sent — if this throws,
  // nothing is persisted and the offer letter correctly stays disabled.
  const pdfBuffer = await renderOfferLetterPdf(enrollment);

  const fileName = `Offer-Letter-${enrollment.user.firstName}-${enrollment.user.lastName}.pdf`.replace(/\s+/g, '-');
  const filePath = path.join(OFFER_LETTER_DIR, `${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(filePath, pdfBuffer);

  const offerLetter = await prisma.offerLetter.create({
    data: { enrollmentId: enrollment.id, filePath, fileName, generatedById: req.user.id },
  });

  await prisma.internshipAudit.create({
    data: { enrollmentId: enrollment.id, action: 'OFFER_LETTER_GENERATED', actorId: req.user.id },
  });

  // The offer letter is enabled/available as of this point regardless of
  // whether the email succeeds — a mail failure must not disable it or fail
  // this response; "Resend Email" is the recovery path. sendMail() never
  // throws (it swallows and logs its own errors), so its boolean return
  // value — not a try/catch — is what tells us whether it actually sent.
  const emailSent = await sendOfferLetterAvailableEmail(enrollment, pdfBuffer, fileName);

  return sendSuccess(res, 201, { ...offerLetter, emailSent });
}

// POST /api/interns/enrollments/:id/offer-letter/resend-email — explicit
// re-send using the already-generated PDF (never regenerates it).
async function resendOfferLetterEmail(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { firstName: true, lastName: true, email: true } }, batch: true },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertCanManageLifecycle(req, enrollment);

  const offerLetter = await prisma.offerLetter.findUnique({ where: { enrollmentId: enrollment.id } });
  if (!offerLetter) throw new ApiError(400, 'The offer letter has not been enabled yet');

  const pdfBuffer = fs.readFileSync(offerLetter.filePath);
  const emailSent = await sendOfferLetterAvailableEmail(enrollment, pdfBuffer, offerLetter.fileName);
  if (!emailSent) throw new ApiError(502, 'Failed to send the offer letter email — please try again');

  return sendSuccess(res, 200, { message: 'Offer letter email resent' });
}

// GET /api/interns/enrollments/:id/offer-letter/download
async function downloadOfferLetter(req, res) {
  const offerLetter = await prisma.offerLetter.findUnique({
    where: { enrollmentId: req.params.id },
    include: { enrollment: { select: { userId: true, mentorId: true } } },
  });
  if (!offerLetter) throw new ApiError(404, 'Offer letter has not been generated yet');

  assertAdminOrOwnerAccess(req, offerLetter.enrollment);

  await prisma.internshipAudit.create({
    data: { enrollmentId: req.params.id, action: 'OFFER_LETTER_DOWNLOADED', actorId: req.user.id },
  });

  return res.download(path.resolve(offerLetter.filePath), offerLetter.fileName);
}

// POST /api/interns/enrollments/:id/certificate — Super Admin generates the completion certificate PDF
async function generateCertificate(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { firstName: true, lastName: true, email: true } }, batch: true },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  if (!enrollment.finalApprovedAt) {
    throw new ApiError(400, 'Enrollment must receive final approval before a certificate can be generated');
  }
  if (!enrollment.internshipEndDate || new Date() < new Date(enrollment.internshipEndDate)) {
    throw new ApiError(400, 'The completion certificate is only available after the internship end date');
  }

  const verificationId = `CC-${enrollment.id.slice(0, 8).toUpperCase()}`;
  const qrCodeDataUrl = await generateQrDataUrl(`${process.env.APP_URL}/verify/certificate/${enrollment.id}`);
  const brandVars = await getBrandTemplateVars();

  const html = renderPdfTemplate('completionCertificate.html', {
    ...brandVars,
    firstName: enrollment.user.firstName,
    lastName: enrollment.user.lastName,
    categoryLabel: CATEGORY_LABELS[enrollment.category] || 'Internship',
    collegeName: enrollment.collegeName || '—',
    course: enrollment.course || '—',
    branch: enrollment.branch || '—',
    registerNumber: enrollment.registerNumber || '—',
    batchName: enrollment.batch.name,
    internshipStartDate: enrollment.internshipStartDate ? new Date(enrollment.internshipStartDate).toLocaleDateString() : '—',
    internshipEndDate: enrollment.internshipEndDate ? new Date(enrollment.internshipEndDate).toLocaleDateString() : '—',
    generatedDate: new Date().toLocaleDateString(),
    qrCodeDataUrl,
    verificationId,
  });

  const pdfBuffer = await renderHtmlToPdf(html);
  const fileName = `Completion-Certificate-${enrollment.user.firstName}-${enrollment.user.lastName}.pdf`.replace(/\s+/g, '-');
  const filePath = path.join(CERTIFICATE_DIR, `${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(filePath, pdfBuffer);

  const existing = await prisma.completionCertificate.findUnique({ where: { enrollmentId: enrollment.id } });
  if (existing) fs.unlink(existing.filePath, () => {});

  const certificate = await prisma.completionCertificate.upsert({
    where: { enrollmentId: enrollment.id },
    update: { filePath, fileName, generatedById: req.user.id, generatedAt: new Date() },
    create: { enrollmentId: enrollment.id, filePath, fileName, generatedById: req.user.id },
  });

  await prisma.internshipAudit.create({
    data: { enrollmentId: enrollment.id, action: 'CERTIFICATE_GENERATED', actorId: req.user.id },
  });
  await notify({
    userId: enrollment.userId, type: 'CERTIFICATE_GENERATED', title: 'Your completion certificate is ready',
    link: '/documents',
  });

  await sendMail({
    to: enrollment.user.email,
    subject: 'VertexWM — Your Completion Certificate',
    html: renderEmailTemplate('certificateGenerated.html', {
      firstName: enrollment.user.firstName,
      appUrl: process.env.APP_URL,
    }),
    attachments: [{ filename: fileName, content: pdfBuffer }],
  });

  return sendSuccess(res, 201, certificate);
}

// GET /api/interns/enrollments/:id/certificate/download
async function downloadCertificate(req, res) {
  const certificate = await prisma.completionCertificate.findUnique({
    where: { enrollmentId: req.params.id },
    include: { enrollment: { select: { userId: true, mentorId: true } } },
  });
  if (!certificate) throw new ApiError(404, 'Completion certificate has not been generated yet');

  assertAdminOrOwnerAccess(req, certificate.enrollment);

  await prisma.internshipAudit.create({
    data: { enrollmentId: req.params.id, action: 'CERTIFICATE_DOWNLOADED', actorId: req.user.id },
  });

  return res.download(path.resolve(certificate.filePath), certificate.fileName);
}

module.exports = {
  createIntern,
  listBatches, getBatch, createBatch, updateBatch, deleteBatch,
  listEnrollments, listEnrollableUsers, enrollIntern, updateEnrollment, deleteEnrollment, restoreEnrollment, permanentlyDeleteEnrollment, updateMyEnrollment,
  finalApprove, enableOfferLetter, resendOfferLetterEmail, downloadOfferLetter, generateCertificate, downloadCertificate,
};
