const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// Internal enquiry topic, distinct from `source` (external lead attribution
// channel, unchanged). The allowed set is role-scoped rather than a single
// shared enum — SUPER_ADMIN and ADMIN share the Business Development set;
// EMPLOYEE and INTERN each get their own self-service topic list.
const CATEGORIES_BY_ROLE = {
  SUPER_ADMIN: ['GENERAL', 'HR', 'EMPLOYEE', 'INTERN', 'WORK', 'CLIENT', 'BUSINESS', 'OTHER'],
  ADMIN: ['GENERAL', 'HR', 'EMPLOYEE', 'INTERN', 'WORK', 'CLIENT', 'BUSINESS', 'OTHER'],
  EMPLOYEE: ['HR', 'PAYROLL', 'LEAVE', 'ATTENDANCE', 'TASK', 'IT_SUPPORT', 'GENERAL'],
  INTERN: ['INTERNSHIP', 'TRAINING', 'TASK', 'ATTENDANCE', 'LEAVE', 'MENTOR', 'IT_SUPPORT', 'GENERAL'],
};

// Business-Development-pipeline stages (NEW/CONTACTED/CONVERTED) don't apply
// to an internal self-service enquiry — a non-manager may only move their
// own enquiry through this narrower, appropriate subset.
const NON_MANAGER_ALLOWED_STATUSES = ['IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CLOSED', 'CANCELLED'];

function withEnquiryFlags(e) {
  const now = new Date();
  const followUpOverdue = !!e.followUpDate && new Date(e.followUpDate) < now && !['CONVERTED', 'CLOSED', 'CANCELLED'].includes(e.status);
  return { ...e, followUpOverdue };
}

async function listEnquiries(req, res) {
  const { status, source, assignedEmployeeId, search } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const enquiries = await prisma.enquiry.findMany({
    where: {
      ...(status && { status }),
      ...(source && { source }),
      ...(assignedEmployeeId && isManagerRole && { assignedEmployeeId }),
      ...(!isManagerRole && { assignedEmployeeId: req.user.id }),
      ...(search && {
        OR: [
          { contactName: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, enquiries.map(withEnquiryFlags));
}

async function getEnquiry(req, res) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: req.params.id },
    include: {
      assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!enquiry) throw new ApiError(404, 'Enquiry not found');

  // SUPER_ADMIN/ADMIN see every enquiry (matches listEnquiries' existing
  // unscoped visibility for managers); EMPLOYEE/INTERN may only view an
  // enquiry they're the assignee of (which, since non-managers are always
  // self-assigned on creation, is exactly "their own" enquiry).
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!isManagerRole && enquiry.assignedEmployeeId !== req.user.id) {
    throw new ApiError(403, 'Not authorized to view this enquiry');
  }

  return sendSuccess(res, 200, withEnquiryFlags(enquiry));
}

// POST /api/enquiries — open to every role (see enquiry.routes.js).
// SUPER_ADMIN/ADMIN log external Business Development leads with full
// contact details; EMPLOYEE/INTERN log an internal enquiry about
// themselves — their identity/contact info is always derived from their own
// profile (never trusted from the request body, so they cannot log an
// enquiry impersonating a different contact), and they are unconditionally
// self-assigned regardless of any `assignedEmployeeId` sent — otherwise they
// could log an enquiry and immediately lose visibility into it under
// listEnquiries' assignedEmployeeId-scoped query, or worse, assign it to
// someone else. Only a manager may assign a new enquiry to someone else (or
// leave it unassigned).
async function createEnquiry(req, res) {
  const {
    contactName, contactEmail, contactPhone, companyName, subject, description,
    source, category, assignedEmployeeId, status, followUpDate, nextAction, remarks,
  } = req.body;

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const allowedCategories = CATEGORIES_BY_ROLE[req.user.role] || [];

  if (!subject) throw new ApiError(400, 'subject is required');
  if (!category || !allowedCategories.includes(category)) {
    throw new ApiError(400, `category must be one of: ${allowedCategories.join(', ')}`);
  }
  if (isManagerRole) {
    if (!contactName || !contactPhone) throw new ApiError(400, 'contactName and phone are required');
  } else if (!description) {
    throw new ApiError(400, 'description is required');
  }

  const enquiry = await prisma.enquiry.create({
    data: {
      contactName: isManagerRole ? contactName : `${req.user.firstName} ${req.user.lastName}`,
      contactEmail: isManagerRole ? contactEmail : req.user.email,
      contactPhone: isManagerRole ? contactPhone : req.user.phone,
      companyName: isManagerRole ? companyName : null,
      subject, description, category,
      source: source || 'WEBSITE',
      assignedEmployeeId: isManagerRole ? (assignedEmployeeId || null) : req.user.id,
      status: status || 'NEW',
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      nextAction, remarks,
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'ENQUIRY', entityId: enquiry.id, entityLabel: enquiry.subject, after: enquiry });
  return sendSuccess(res, 201, enquiry);
}

async function updateEnquiry(req, res) {
  const before = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Enquiry not found');

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const isAssignee = req.user.id === before.assignedEmployeeId;
  if (!isManagerRole && !isAssignee) {
    throw new ApiError(403, 'Only the assigned employee or a manager can update this enquiry');
  }

  const {
    contactName, contactEmail, contactPhone, companyName, subject, description,
    source, category, assignedEmployeeId, status, followUpDate, nextAction, remarks,
  } = req.body;

  if (category !== undefined && category !== null) {
    const allowedCategories = CATEGORIES_BY_ROLE[req.user.role] || [];
    if (!allowedCategories.includes(category)) {
      throw new ApiError(400, `category must be one of: ${allowedCategories.join(', ')}`);
    }
  }
  // A non-manager may only move their own enquiry through the appropriate
  // internal-workflow statuses — the Business Development pipeline stages
  // (NEW/CONTACTED/CONVERTED) aren't theirs to set.
  if (!isManagerRole && status !== undefined && !NON_MANAGER_ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${NON_MANAGER_ALLOWED_STATUSES.join(', ')}`);
  }

  const enquiry = await prisma.enquiry.update({
    where: { id: req.params.id },
    data: {
      // Contact/company/source/assignment are Business-Development-lead
      // concepts a non-manager's internal enquiry never had to begin with —
      // restricting these to managers here means a direct API call can't
      // manipulate them either, not just the form hiding them.
      ...(isManagerRole && contactName !== undefined && { contactName }),
      ...(isManagerRole && contactEmail !== undefined && { contactEmail }),
      ...(isManagerRole && contactPhone !== undefined && { contactPhone }),
      ...(isManagerRole && companyName !== undefined && { companyName }),
      ...(isManagerRole && source !== undefined && { source }),
      ...(subject !== undefined && { subject }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      // Reassigning to a different employee is a manager-only action.
      ...(isManagerRole && assignedEmployeeId !== undefined && { assignedEmployeeId: assignedEmployeeId || null }),
      ...(status !== undefined && { status }),
      ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
      ...(isManagerRole && nextAction !== undefined && { nextAction }),
      ...(isManagerRole && remarks !== undefined && { remarks }),
    },
  });
  const action = status && status !== before.status ? 'STATUS_CHANGED' : 'UPDATED';
  await recordAudit({ actorId: req.user.id, action, module: 'ENQUIRY', entityId: enquiry.id, entityLabel: enquiry.subject, before, after: enquiry });
  return sendSuccess(res, 200, enquiry);
}

async function deleteEnquiry(req, res) {
  const before = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Enquiry not found');
  await prisma.enquiry.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'ENQUIRY', entityId: before.id, entityLabel: before.subject, before });
  return sendSuccess(res, 200, { message: 'Enquiry removed' });
}

module.exports = { listEnquiries, getEnquiry, createEnquiry, updateEnquiry, deleteEnquiry };
