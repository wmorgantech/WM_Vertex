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

const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'Job Oriented Training (JOT)' };

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

async function listEnrollments(req, res) {
  const { batchId, mentorId, completionStatus, search, page, limit } = req.query;
  const searchClause = search ? {
    user: {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    },
  } : null;

  // SUPER_ADMIN: unrestricted. Everyone else: interns they mentor (includes
  // Admins, and any employee who added an intern and defaulted to mentoring
  // them — see enrollIntern) plus their own enrollment if they have one.
  let where;
  if (req.user.role === 'SUPER_ADMIN') {
    where = {
      ...(batchId && { batchId }),
      ...(mentorId && { mentorId }),
      ...(completionStatus && { completionStatus }),
      ...(searchClause && searchClause),
    };
  } else {
    // The owner-scoping OR and the search OR must stay in separate clauses
    // (combined with AND) — merging them into one OR array would let a
    // matching search term alone satisfy the filter, bypassing ownership.
    where = {
      AND: [
        { OR: [{ mentorId: req.user.id }, { userId: req.user.id }] },
        ...(batchId ? [{ batchId }] : []),
        ...(completionStatus ? [{ completionStatus }] : []),
        ...(searchClause ? [searchClause] : []),
      ],
    };
  }

  // Pagination is opt-in — other callers (e.g. the intern's own dashboard)
  // rely on this endpoint returning their full, unbounded result set, so a
  // request with no page/limit keeps returning exactly what it does today.
  const paginate = page !== undefined || limit !== undefined;
  const take = paginate ? Math.min(parseInt(limit, 10) || 25, 100) : undefined;
  const skip = paginate ? (Math.max(parseInt(page, 10), 1) - 1) * take : undefined;

  const [enrollments, total] = await Promise.all([
    prisma.internEnrollment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
        batch: true,
        mentor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(paginate && { take, skip }),
    }),
    paginate ? prisma.internEnrollment.count({ where }) : Promise.resolve(undefined),
  ]);

  return sendSuccess(res, 200, enrollments, paginate ? { total, page: Math.max(parseInt(page, 10), 1) || 1, limit: take } : undefined);
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

  const enrollment = await prisma.internEnrollment.update({
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
    const enr = await prisma.internEnrollment.findUnique({ where: { id: req.params.id } });
    await prisma.user.update({ where: { id: enr.userId }, data: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' } });
  }

  return sendSuccess(res, 200, enrollment);
}

// DELETE /api/interns/enrollments/:id — gated by intern:manage (Super Admin
// or Admin, see intern.routes.js), soft delete only. The record is kept
// (completionStatus -> TERMINATED) for audit/history and the intern's
// account is deactivated, rather than removing any rows.
async function deleteEnrollment(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');

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

// POST /api/interns/enrollments/:id/approve — Super Admin final approval
async function finalApprove(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { documents: true, user: { select: { firstName: true, email: true } }, batch: true },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');

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

  await sendMail({
    to: enrollment.user.email,
    subject: 'VertexWM — Internship Approved',
    html: renderEmailTemplate('internshipApproved.html', {
      firstName: enrollment.user.firstName,
      category: CATEGORY_LABELS[enrollment.category] || 'Internship',
      batchName: enrollment.batch.name,
      appUrl: process.env.APP_URL,
    }),
  });

  return sendSuccess(res, 200, updated);
}

// POST /api/interns/enrollments/:id/offer-letter — Super Admin generates the offer letter PDF
async function generateOfferLetter(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { firstName: true, lastName: true, email: true } }, batch: true },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  if (!enrollment.finalApprovedAt) {
    throw new ApiError(400, 'Enrollment must receive final approval before an offer letter can be generated');
  }

  const verificationId = `OL-${enrollment.id.slice(0, 8).toUpperCase()}`;
  const qrCodeDataUrl = await generateQrDataUrl(`${process.env.APP_URL}/verify/offer-letter/${enrollment.id}`);
  const brandVars = await getBrandTemplateVars();

  const html = renderPdfTemplate('offerLetter.html', {
    ...brandVars,
    firstName: enrollment.user.firstName,
    lastName: enrollment.user.lastName,
    categoryLabel: CATEGORY_LABELS[enrollment.category] || 'Internship',
    collegeName: enrollment.collegeName || '—',
    university: enrollment.university || '—',
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
  const fileName = `Offer-Letter-${enrollment.user.firstName}-${enrollment.user.lastName}.pdf`.replace(/\s+/g, '-');
  const filePath = path.join(OFFER_LETTER_DIR, `${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(filePath, pdfBuffer);

  const existing = await prisma.offerLetter.findUnique({ where: { enrollmentId: enrollment.id } });
  if (existing) fs.unlink(existing.filePath, () => {});

  const offerLetter = await prisma.offerLetter.upsert({
    where: { enrollmentId: enrollment.id },
    update: { filePath, fileName, generatedById: req.user.id, generatedAt: new Date() },
    create: { enrollmentId: enrollment.id, filePath, fileName, generatedById: req.user.id },
  });

  await prisma.internshipAudit.create({
    data: { enrollmentId: enrollment.id, action: 'OFFER_LETTER_GENERATED', actorId: req.user.id },
  });

  await sendMail({
    to: enrollment.user.email,
    subject: 'VertexWM — Your Offer Letter',
    html: renderEmailTemplate('offerLetterGenerated.html', {
      firstName: enrollment.user.firstName,
      category: CATEGORY_LABELS[enrollment.category] || 'Internship',
      appUrl: process.env.APP_URL,
    }),
    attachments: [{ filename: fileName, content: pdfBuffer }],
  });

  return sendSuccess(res, 201, offerLetter);
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
  listEnrollments, listEnrollableUsers, enrollIntern, updateEnrollment, deleteEnrollment, updateMyEnrollment,
  finalApprove, generateOfferLetter, downloadOfferLetter, generateCertificate, downloadCertificate,
};
