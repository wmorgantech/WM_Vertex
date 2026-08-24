const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { sendMail, renderEmailTemplate } = require('../services/email.service');
const { computeInternshipStage } = require('../utils/internshipStage');
const { notify } = require('../utils/notify');
const { evaluateRequiredDocs } = require('../utils/internDocumentRequirements');

const DOC_TYPE_LABELS = {
  BONAFIDE: 'Bonafide Certificate',
  PERMISSION_LETTER: 'Permission Letter',
  COLLEGE_ID: 'College ID Card',
  RESUME: 'Resume',
  ADDITIONAL: 'Additional Document',
};

// One active document per type — re-uploading replaces the previous file and
// resets it to DRAFT (see uploadDocument below).
const SINGLE_TYPES = ['BONAFIDE', 'PERMISSION_LETTER', 'COLLEGE_ID', 'RESUME'];
const PROFILE_FIELDS = [
  'collegeName', 'university', 'collegeDepartment', 'course', 'branch', 'year', 'semester',
  'registerNumber', 'collegeEmail', 'hodName', 'internshipStartDate', 'internshipEndDate',
];

function computeProfileCompletion(enrollment) {
  const filled = PROFILE_FIELDS.filter((f) => enrollment[f] !== null && enrollment[f] !== undefined && enrollment[f] !== '');
  return Math.round((filled.length / PROFILE_FIELDS.length) * 100);
}

async function getOwnEnrollment(userId) {
  const enrollment = await prisma.internEnrollment.findUnique({ where: { userId } });
  if (!enrollment) throw new ApiError(404, 'No internship enrollment found. Contact an admin to be enrolled in a batch.');
  return enrollment;
}

// GET /api/documents/mine — Intern's own profile + documents + progress
async function getMine(req, res) {
  const enrollment = await getOwnEnrollment(req.user.id);
  const documents = await prisma.internDocument.findMany({
    where: { enrollmentId: enrollment.id },
    orderBy: { uploadedAt: 'desc' },
  });
  const [offerLetter, certificate] = await Promise.all([
    prisma.offerLetter.findUnique({ where: { enrollmentId: enrollment.id }, select: { generatedAt: true } }),
    prisma.completionCertificate.findUnique({ where: { enrollmentId: enrollment.id }, select: { generatedAt: true } }),
  ]);

  const requirement = evaluateRequiredDocs(documents);
  const verifiedAll = documents.filter((d) => d.status === 'VERIFIED').length;

  return sendSuccess(res, 200, {
    enrollment,
    documents,
    profileCompletionPercent: computeProfileCompletion(enrollment),
    verification: {
      verifiedRequired: requirement.groups.filter((g) => g.status === 'VERIFIED').length,
      totalRequired: requirement.groups.length,
      requiredGroups: requirement.groups,
      verifiedAll,
      totalUploaded: documents.length,
    },
    stage: computeInternshipStage(enrollment, documents, offerLetter, certificate),
    offerLetter,
    certificate,
  });
}

// POST /api/documents/upload — Intern uploads/re-uploads a document
async function uploadDocument(req, res) {
  if (!req.file) throw new ApiError(400, 'A file is required');
  const { type } = req.body;
  if (!type || !['BONAFIDE', 'PERMISSION_LETTER', 'COLLEGE_ID', 'RESUME', 'ADDITIONAL'].includes(type)) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, 'A valid document type is required');
  }

  const enrollment = await getOwnEnrollment(req.user.id);

  const fileData = {
    fileName: req.file.originalname,
    filePath: req.file.path,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
  };

  let document;
  if (SINGLE_TYPES.includes(type)) {
    const existing = await prisma.internDocument.findFirst({ where: { enrollmentId: enrollment.id, type } });
    if (existing && ['PENDING_REVIEW', 'VERIFIED'].includes(existing.status)) {
      fs.unlink(req.file.path, () => {});
      throw new ApiError(409, 'This document is already submitted or verified and cannot be replaced');
    }
    if (existing) {
      const oldPath = existing.filePath;
      document = await prisma.internDocument.update({
        where: { id: existing.id },
        data: { ...fileData, status: 'DRAFT', adminRemarks: null, reviewedById: null, reviewedAt: null, uploadedAt: new Date() },
      });
      fs.unlink(oldPath, () => {});
    } else {
      document = await prisma.internDocument.create({
        data: { enrollmentId: enrollment.id, type, ...fileData, status: 'DRAFT' },
      });
    }
  } else {
    document = await prisma.internDocument.create({
      data: { enrollmentId: enrollment.id, type, ...fileData, status: 'DRAFT' },
    });
  }

  await prisma.internDocumentAudit.create({
    data: { documentId: document.id, action: 'UPLOADED', actorId: req.user.id },
  });

  return sendSuccess(res, 201, document);
}

// POST /api/documents/submit — Intern submits all draft documents for review
async function submitForVerification(req, res) {
  const enrollment = await getOwnEnrollment(req.user.id);
  const documents = await prisma.internDocument.findMany({ where: { enrollmentId: enrollment.id } });

  const requirement = evaluateRequiredDocs(documents);
  for (const group of requirement.groups) {
    if (!['DRAFT', 'PENDING_REVIEW', 'VERIFIED'].includes(group.status)) {
      throw new ApiError(400, `${group.label} must be uploaded before submitting for verification`);
    }
  }

  const draftDocs = documents.filter((d) => d.status === 'DRAFT');
  if (draftDocs.length === 0) {
    throw new ApiError(400, 'No draft documents to submit');
  }

  await prisma.internDocument.updateMany({
    where: { id: { in: draftDocs.map((d) => d.id) } },
    data: { status: 'PENDING_REVIEW' },
  });
  await prisma.internDocumentAudit.createMany({
    data: draftDocs.map((d) => ({ documentId: d.id, action: 'SUBMITTED', actorId: req.user.id })),
  });

  const updated = await prisma.internDocument.findMany({ where: { enrollmentId: enrollment.id } });
  return sendSuccess(res, 200, updated);
}

// GET /api/documents — Admin/Super Admin review queue
// SUPER_ADMIN sees every enrollment; ADMIN only sees interns they mentor ("records assigned to them").
async function listAll(req, res) {
  const where = req.user.role === 'ADMIN' ? { mentorId: req.user.id } : {};
  const enrollments = await prisma.internEnrollment.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      batch: { select: { id: true, name: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      offerLetter: { select: { generatedAt: true } },
      certificate: { select: { generatedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, enrollments);
}

// GET /api/documents/enrollment/:enrollmentId — Admin/Super Admin single-intern detail
async function getEnrollmentDetail(req, res) {
  const enrollment = await prisma.internEnrollment.findUnique({
    where: { id: req.params.enrollmentId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      batch: { select: { id: true, name: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      offerLetter: { select: { generatedAt: true } },
      certificate: { select: { generatedAt: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  if (req.user.role === 'ADMIN' && enrollment.mentorId !== req.user.id) {
    throw new ApiError(403, 'You can only review interns assigned to you');
  }
  return sendSuccess(res, 200, { ...enrollment, requirement: evaluateRequiredDocs(enrollment.documents) });
}

async function assertAdminOwnsDocument(req, documentId) {
  if (req.user.role !== 'ADMIN') return; // SUPER_ADMIN unrestricted
  const doc = await prisma.internDocument.findUnique({
    where: { id: documentId },
    include: { enrollment: { select: { mentorId: true } } },
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  if (doc.enrollment.mentorId !== req.user.id) {
    throw new ApiError(403, 'You can only review documents for interns assigned to you');
  }
}

// PATCH /api/documents/:id/approve
async function approve(req, res) {
  await assertAdminOwnsDocument(req, req.params.id);

  const document = await prisma.internDocument.update({
    where: { id: req.params.id },
    data: { status: 'VERIFIED', adminRemarks: null, reviewedById: req.user.id, reviewedAt: new Date() },
    include: { enrollment: { select: { userId: true } } },
  });
  await prisma.internDocumentAudit.create({
    data: { documentId: document.id, action: 'APPROVED', actorId: req.user.id },
  });
  await notify({
    userId: document.enrollment.userId, type: 'DOCUMENT_REVIEWED', title: 'Document verified',
    message: `${DOC_TYPE_LABELS[document.type]} was verified.`, link: '/documents',
  });
  return sendSuccess(res, 200, document);
}

// PATCH /api/documents/:id/reject
async function reject(req, res) {
  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) throw new ApiError(400, 'A rejection reason is required');

  await assertAdminOwnsDocument(req, req.params.id);

  const document = await prisma.internDocument.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', adminRemarks: remarks, reviewedById: req.user.id, reviewedAt: new Date() },
    include: { enrollment: { include: { user: { select: { firstName: true, email: true } } } } },
  });
  await prisma.internDocumentAudit.create({
    data: { documentId: document.id, action: 'REJECTED', actorId: req.user.id, remarks },
  });

  const { user } = document.enrollment;
  await sendMail({
    to: user.email,
    subject: 'VertexWM — Document Rejected, Re-upload Required',
    html: renderEmailTemplate('documentRejected.html', {
      firstName: user.firstName,
      documentType: DOC_TYPE_LABELS[document.type],
      remarks,
      appUrl: process.env.APP_URL,
    }),
  });
  await notify({
    userId: document.enrollment.userId, type: 'DOCUMENT_REVIEWED', title: 'Document rejected — re-upload required',
    message: `${DOC_TYPE_LABELS[document.type]}: ${remarks}`, link: '/documents',
  });

  return sendSuccess(res, 200, document);
}

// GET /api/documents/:id/download
async function download(req, res) {
  const document = await prisma.internDocument.findUnique({
    where: { id: req.params.id },
    include: { enrollment: { select: { userId: true, mentorId: true } } },
  });
  if (!document) throw new ApiError(404, 'Document not found');

  const isOwner = document.enrollment.userId === req.user.id;

  if (req.user.role === 'SUPER_ADMIN') {
    // allowed regardless of status — full access
  } else if (req.user.role === 'ADMIN') {
    if (document.enrollment.mentorId !== req.user.id) {
      throw new ApiError(403, 'You can only access documents for interns assigned to you');
    }
  } else if (req.user.role === 'INTERN' && isOwner) {
    if (document.status !== 'VERIFIED') throw new ApiError(403, 'Only verified documents can be downloaded');
  } else {
    throw new ApiError(403, 'You do not have permission to access this document');
  }

  return res.download(path.resolve(document.filePath), document.fileName);
}

module.exports = {
  getMine, uploadDocument, submitForVerification, listAll, getEnrollmentDetail, approve, reject, download,
};
