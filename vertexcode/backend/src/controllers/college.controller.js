const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

const MOU_EXPIRY_WARNING_DAYS = 30;

// --- Colleges ------------------------------------------------------------------

async function listColleges(req, res) {
  const colleges = await prisma.college.findMany({
    include: {
      type: true,
      departments: true,
      _count: { select: { workshops: true, mous: true } },
    },
    orderBy: { name: 'asc' },
  });
  return sendSuccess(res, 200, colleges);
}

async function getCollege(req, res) {
  const college = await prisma.college.findUnique({
    where: { id: req.params.id },
    include: {
      type: true,
      departments: true,
      workshops: { orderBy: { createdAt: 'desc' } },
      mous: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!college) throw new ApiError(404, 'College not found');
  return sendSuccess(res, 200, college);
}

async function createCollege(req, res) {
  const { name, typeCode, university, address, city, district, state, website, contactPerson, phone, email, coordinator } = req.body;
  if (!name) throw new ApiError(400, 'College name is required');

  const existing = await prisma.college.findUnique({ where: { name } });
  if (existing) throw new ApiError(409, 'A college with this name already exists');

  const college = await prisma.college.create({
    data: { name, typeCode: typeCode || null, university, address, city, district, state, website, contactPerson, phone, email, coordinator },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'COLLEGE', entityId: college.id, entityLabel: college.name, after: college });
  return sendSuccess(res, 201, college);
}

async function updateCollege(req, res) {
  const before = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'College not found');
  const { name, typeCode, university, address, city, district, state, website, contactPerson, phone, email, coordinator, active } = req.body;
  const college = await prisma.college.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(typeCode !== undefined && { typeCode: typeCode || null }),
      ...(university !== undefined && { university }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(district !== undefined && { district }),
      ...(state !== undefined && { state }),
      ...(website !== undefined && { website }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(coordinator !== undefined && { coordinator }),
      ...(active !== undefined && { active }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'COLLEGE', entityId: college.id, entityLabel: college.name, before, after: college });
  return sendSuccess(res, 200, college);
}

async function deleteCollege(req, res) {
  const before = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'College not found');
  await prisma.college.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'COLLEGE', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'College removed' });
}

// --- College Departments --------------------------------------------------------

async function createCollegeDepartment(req, res) {
  const { collegeId, name, contactPerson, contactPhone, contactEmail } = req.body;
  if (!collegeId || !name) throw new ApiError(400, 'collegeId and name are required');
  const row = await prisma.collegeDepartment.create({ data: { collegeId, name, contactPerson, contactPhone, contactEmail } });
  return sendSuccess(res, 201, row);
}

async function updateCollegeDepartment(req, res) {
  const { name, contactPerson, contactPhone, contactEmail } = req.body;
  const row = await prisma.collegeDepartment.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(contactEmail !== undefined && { contactEmail }),
    },
  });
  return sendSuccess(res, 200, row);
}

async function deleteCollegeDepartment(req, res) {
  await prisma.collegeDepartment.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Department removed' });
}

// --- Workshops -------------------------------------------------------------------

function withWorkshopFlags(w) {
  const now = new Date();
  const followUpOverdue = !!w.followUpDate && new Date(w.followUpDate) < now && !['COMPLETED', 'CANCELLED'].includes(w.status);
  return { ...w, followUpOverdue };
}

async function listWorkshops(req, res) {
  const { status, collegeId, assignedEmployeeId } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const workshops = await prisma.workshop.findMany({
    where: {
      ...(status && { status }),
      ...(collegeId && { collegeId }),
      ...(assignedEmployeeId && isManagerRole && { assignedEmployeeId }),
      ...(!isManagerRole && { assignedEmployeeId: req.user.id }),
    },
    include: {
      college: { select: { id: true, name: true, city: true } },
      collegeDepartment: { select: { id: true, name: true } },
      assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
      trainer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, workshops.map(withWorkshopFlags));
}

async function getWorkshop(req, res) {
  const workshop = await prisma.workshop.findUnique({
    where: { id: req.params.id },
    include: {
      college: true,
      collegeDepartment: true,
      assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
      trainer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!workshop) throw new ApiError(404, 'Workshop not found');
  return sendSuccess(res, 200, withWorkshopFlags(workshop));
}

async function createWorkshop(req, res) {
  const {
    collegeId, collegeDepartmentId, contactPerson, contactNumber, contactEmail, topic, technology,
    proposedDate, confirmedDate, duration, expectedParticipants, assignedEmployeeId, trainerId,
    status, followUpDate, discussionNotes, nextAction, remarks,
  } = req.body;
  if (!collegeId || !topic) throw new ApiError(400, 'collegeId and topic are required');

  const workshop = await prisma.workshop.create({
    data: {
      collegeId, collegeDepartmentId: collegeDepartmentId || null, contactPerson, contactNumber, contactEmail, topic, technology,
      proposedDate: proposedDate ? new Date(proposedDate) : null,
      confirmedDate: confirmedDate ? new Date(confirmedDate) : null,
      duration,
      expectedParticipants: expectedParticipants ?? null,
      assignedEmployeeId: assignedEmployeeId || null,
      trainerId: trainerId || null,
      status: status || 'LEAD',
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      discussionNotes, nextAction, remarks,
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'WORKSHOP', entityId: workshop.id, entityLabel: workshop.topic, after: workshop });
  return sendSuccess(res, 201, workshop);
}

async function updateWorkshop(req, res) {
  const before = await prisma.workshop.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Workshop not found');

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const isAssignee = req.user.id === before.assignedEmployeeId;
  if (!isManagerRole && !isAssignee) {
    throw new ApiError(403, 'Only the assigned employee or a manager can update this workshop');
  }

  const {
    collegeDepartmentId, contactPerson, contactNumber, contactEmail, topic, technology,
    proposedDate, confirmedDate, duration, expectedParticipants, actualParticipants,
    assignedEmployeeId, trainerId, status, followUpDate, discussionNotes, nextAction, remarks,
  } = req.body;

  const workshop = await prisma.workshop.update({
    where: { id: req.params.id },
    data: {
      ...(collegeDepartmentId !== undefined && { collegeDepartmentId: collegeDepartmentId || null }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(contactNumber !== undefined && { contactNumber }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(topic !== undefined && { topic }),
      ...(technology !== undefined && { technology }),
      ...(proposedDate !== undefined && { proposedDate: proposedDate ? new Date(proposedDate) : null }),
      ...(confirmedDate !== undefined && { confirmedDate: confirmedDate ? new Date(confirmedDate) : null }),
      ...(duration !== undefined && { duration }),
      ...(expectedParticipants !== undefined && { expectedParticipants }),
      ...(actualParticipants !== undefined && { actualParticipants }),
      // Reassigning to a different employee/trainer is a manager-only action.
      ...(isManagerRole && assignedEmployeeId !== undefined && { assignedEmployeeId: assignedEmployeeId || null }),
      ...(isManagerRole && trainerId !== undefined && { trainerId: trainerId || null }),
      ...(status !== undefined && { status }),
      ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
      ...(discussionNotes !== undefined && { discussionNotes }),
      ...(nextAction !== undefined && { nextAction }),
      ...(remarks !== undefined && { remarks }),
    },
  });
  const action = status && status !== before.status ? 'STATUS_CHANGED' : 'UPDATED';
  await recordAudit({ actorId: req.user.id, action, module: 'WORKSHOP', entityId: workshop.id, entityLabel: workshop.topic, before, after: workshop });
  return sendSuccess(res, 200, workshop);
}

async function deleteWorkshop(req, res) {
  const before = await prisma.workshop.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Workshop not found');
  await prisma.workshop.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'WORKSHOP', entityId: before.id, entityLabel: before.topic, before });
  return sendSuccess(res, 200, { message: 'Workshop removed' });
}

// --- MOUs --------------------------------------------------------------------------

function withMouFlags(m) {
  const now = new Date();
  const msPerDay = 86400000;
  const daysToExpiry = m.endDate ? Math.ceil((new Date(m.endDate) - now) / msPerDay) : null;
  const expiringSoon = m.status === 'ACTIVE' && daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= MOU_EXPIRY_WARNING_DAYS;
  const expired = m.status === 'ACTIVE' && daysToExpiry !== null && daysToExpiry < 0;
  return { ...m, daysToExpiry, expiringSoon, expired };
}

async function listMous(req, res) {
  const { status, collegeId, assignedEmployeeId } = req.query;
  const mous = await prisma.mOU.findMany({
    where: {
      ...(status && { status }),
      ...(collegeId && { collegeId }),
      ...(assignedEmployeeId && { assignedEmployeeId }),
    },
    include: {
      college: { select: { id: true, name: true, city: true } },
      collegeDepartment: { select: { id: true, name: true } },
      assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, mous.map(withMouFlags));
}

async function getMou(req, res) {
  const mou = await prisma.mOU.findUnique({
    where: { id: req.params.id },
    include: {
      college: true,
      collegeDepartment: true,
      assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!mou) throw new ApiError(404, 'MOU not found');
  return sendSuccess(res, 200, withMouFlags(mou));
}

async function createMou(req, res) {
  const {
    collegeId, collegeDepartmentId, contactPerson, mouType, purpose, startDate, endDate,
    status, assignedEmployeeId, signedDate, renewalDate, remarks,
  } = req.body;
  if (!collegeId) throw new ApiError(400, 'collegeId is required');

  const mou = await prisma.mOU.create({
    data: {
      collegeId, collegeDepartmentId: collegeDepartmentId || null, contactPerson, mouType, purpose,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'DISCUSSION',
      assignedEmployeeId: assignedEmployeeId || null,
      signedDate: signedDate ? new Date(signedDate) : null,
      renewalDate: renewalDate ? new Date(renewalDate) : null,
      remarks,
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'MOU', entityId: mou.id, entityLabel: mou.mouType || mou.id, after: mou });
  return sendSuccess(res, 201, mou);
}

async function updateMou(req, res) {
  const before = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'MOU not found');

  const {
    collegeDepartmentId, contactPerson, mouType, purpose, startDate, endDate,
    status, assignedEmployeeId, signedDate, renewalDate, remarks,
  } = req.body;

  const mou = await prisma.mOU.update({
    where: { id: req.params.id },
    data: {
      ...(collegeDepartmentId !== undefined && { collegeDepartmentId: collegeDepartmentId || null }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(mouType !== undefined && { mouType }),
      ...(purpose !== undefined && { purpose }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status !== undefined && { status }),
      ...(assignedEmployeeId !== undefined && { assignedEmployeeId: assignedEmployeeId || null }),
      ...(signedDate !== undefined && { signedDate: signedDate ? new Date(signedDate) : null }),
      ...(renewalDate !== undefined && { renewalDate: renewalDate ? new Date(renewalDate) : null }),
      ...(remarks !== undefined && { remarks }),
    },
  });
  const action = status && status !== before.status ? 'STATUS_CHANGED' : 'UPDATED';
  await recordAudit({ actorId: req.user.id, action, module: 'MOU', entityId: mou.id, entityLabel: mou.mouType || mou.id, before, after: mou });
  return sendSuccess(res, 200, mou);
}

async function deleteMou(req, res) {
  const before = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'MOU not found');
  await prisma.mOU.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'MOU', entityId: before.id, entityLabel: before.mouType || before.id, before });
  return sendSuccess(res, 200, { message: 'MOU removed' });
}

module.exports = {
  listColleges, getCollege, createCollege, updateCollege, deleteCollege,
  createCollegeDepartment, updateCollegeDepartment, deleteCollegeDepartment,
  listWorkshops, getWorkshop, createWorkshop, updateWorkshop, deleteWorkshop,
  listMous, getMou, createMou, updateMou, deleteMou,
};
