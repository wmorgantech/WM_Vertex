const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

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
  return sendSuccess(res, 200, withEnquiryFlags(enquiry));
}

// POST /api/enquiries — open to any staff role (SUPER_ADMIN/ADMIN/EMPLOYEE,
// see enquiry.routes.js), so anyone who takes an inbound enquiry can log it.
// A non-manager creator is unconditionally self-assigned regardless of what
// they send — otherwise they could log an enquiry and immediately lose
// visibility into it under listEnquiries' assignedEmployeeId-scoped query.
// Only a manager may assign a new enquiry to someone else (or leave it
// unassigned).
async function createEnquiry(req, res) {
  const {
    contactName, contactEmail, contactPhone, companyName, subject, description,
    source, assignedEmployeeId, status, followUpDate, nextAction, remarks,
  } = req.body;
  if (!contactName || !subject) throw new ApiError(400, 'contactName and subject are required');

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  const enquiry = await prisma.enquiry.create({
    data: {
      contactName, contactEmail, contactPhone, companyName, subject, description,
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
    source, assignedEmployeeId, status, followUpDate, nextAction, remarks,
  } = req.body;

  const enquiry = await prisma.enquiry.update({
    where: { id: req.params.id },
    data: {
      ...(contactName !== undefined && { contactName }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(companyName !== undefined && { companyName }),
      ...(subject !== undefined && { subject }),
      ...(description !== undefined && { description }),
      ...(source !== undefined && { source }),
      // Reassigning to a different employee is a manager-only action.
      ...(isManagerRole && assignedEmployeeId !== undefined && { assignedEmployeeId: assignedEmployeeId || null }),
      ...(status !== undefined && { status }),
      ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
      ...(nextAction !== undefined && { nextAction }),
      ...(remarks !== undefined && { remarks }),
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
