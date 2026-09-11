const fs = require('fs');
const path = require('path');
const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

const MOU_EXPIRY_WARNING_DAYS = 30;

// --- Colleges ------------------------------------------------------------------

// `scope` mirrors the Departments/Projects Active/All/Trash convention,
// applied to the new deletedAt column (see schema.prisma — College had no
// existing soft-delete field to reuse; `active` is a separate, pre-existing
// business toggle unrelated to Trash, left untouched).
function scopeWhere(scope) {
  if (scope === 'trash') return { deletedAt: { not: null } };
  if (scope === 'all') return {};
  return { deletedAt: null };
}

async function listColleges(req, res) {
  const { search, scope, status, location } = req.query;
  const colleges = await prisma.college.findMany({
    where: {
      ...scopeWhere(scope),
      ...(status && { active: status === 'ACTIVE' }),
      ...(location && { city: location }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      type: true,
      // Newest first, so a just-added department is always the first card
      // in the college's Departments section — no separate client-side sort
      // needed.
      departments: { orderBy: { createdAt: 'desc' } },
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
      departments: { orderBy: { createdAt: 'desc' } },
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

// GET /api/colleges/summary — real counts for the summary cards.
async function collegeSummary(req, res) {
  const [total, trash] = await Promise.all([
    prisma.college.count({ where: { deletedAt: null } }),
    prisma.college.count({ where: { deletedAt: { not: null } } }),
  ]);
  return sendSuccess(res, 200, { total, trash });
}

// DELETE /api/colleges/:id — Super Admin only, soft delete (was previously a
// hard delete). Departments/Workshops/MOUs under this college keep pointing
// at the same row, which still exists — just hidden from the normal
// Active/All-by-default view, same as Departments/Projects' soft delete.
async function deleteCollege(req, res) {
  const before = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'College not found');
  if (before.deletedAt) throw new ApiError(400, 'This college is already in Trash');
  const college = await prisma.college.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'COLLEGE', entityId: before.id, entityLabel: before.name, before, after: college });
  return sendSuccess(res, 200, { message: 'College moved to Trash' });
}

// POST /api/colleges/:id/restore — Super Admin only (same gate as delete).
async function restoreCollege(req, res) {
  const before = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'College not found');
  if (!before.deletedAt) throw new ApiError(400, 'This college is not in Trash');
  const college = await prisma.college.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await recordAudit({ actorId: req.user.id, action: 'RESTORED', module: 'COLLEGE', entityId: before.id, entityLabel: before.name, before, after: college });
  return sendSuccess(res, 200, college);
}

// DELETE /api/colleges/:id/permanent — Super Admin only, irreversible.
// Requires the college already be in Trash. Departments under it cascade
// (CollegeDepartment.college has onDelete: Cascade); Workshops/MOUs
// referencing it do NOT cascade, so the DB's FK constraint rejects the
// delete (surfaced as a 409 by the shared error handler) if any still exist
// — same two-step safety + FK-reliance pattern as Projects' permanent delete.
async function permanentlyDeleteCollege(req, res) {
  const before = await prisma.college.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'College not found');
  if (!before.deletedAt) throw new ApiError(400, 'This college is not in Trash — move it to Trash first');
  await prisma.college.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'PERMANENTLY_DELETED', module: 'COLLEGE', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'College permanently deleted' });
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

// `scope` mirrors the Departments/Projects/Colleges Active/All/Trash
// convention, applied to the new deletedAt column (see schema.prisma).
function workshopScopeWhere(scope) {
  if (scope === 'trash') return { deletedAt: { not: null } };
  if (scope === 'all') return {};
  return { deletedAt: null };
}

async function listWorkshops(req, res) {
  const { status, collegeId, assignedEmployeeId, search, scope } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const workshops = await prisma.workshop.findMany({
    where: {
      ...workshopScopeWhere(scope),
      ...(status && { status }),
      ...(collegeId && { collegeId }),
      ...(assignedEmployeeId && isManagerRole && { assignedEmployeeId }),
      ...(!isManagerRole && { assignedEmployeeId: req.user.id }),
      ...(search && {
        OR: [
          { topic: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { technology: { contains: search, mode: 'insensitive' } },
        ],
      }),
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

// GET /api/workshops/summary — real counts for the summary cards.
async function workshopSummary(req, res) {
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const scopeFilter = isManagerRole ? {} : { assignedEmployeeId: req.user.id };
  const [total, trash] = await Promise.all([
    prisma.workshop.count({ where: { deletedAt: null, ...scopeFilter } }),
    prisma.workshop.count({ where: { deletedAt: { not: null }, ...scopeFilter } }),
  ]);
  return sendSuccess(res, 200, { total, trash });
}

// DELETE /api/workshops/:id — Super Admin only, soft delete (was previously
// a hard delete). Mirrors Departments/Projects/Colleges' soft delete.
async function deleteWorkshop(req, res) {
  const before = await prisma.workshop.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Workshop not found');
  if (before.deletedAt) throw new ApiError(400, 'This workshop is already in Trash');
  const workshop = await prisma.workshop.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'WORKSHOP', entityId: before.id, entityLabel: before.topic, before, after: workshop });
  return sendSuccess(res, 200, { message: 'Workshop moved to Trash' });
}

// POST /api/workshops/:id/restore — Super Admin only (same gate as delete).
async function restoreWorkshop(req, res) {
  const before = await prisma.workshop.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Workshop not found');
  if (!before.deletedAt) throw new ApiError(400, 'This workshop is not in Trash');
  const workshop = await prisma.workshop.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await recordAudit({ actorId: req.user.id, action: 'RESTORED', module: 'WORKSHOP', entityId: before.id, entityLabel: before.topic, before, after: workshop });
  return sendSuccess(res, 200, workshop);
}

// DELETE /api/workshops/:id/permanent — Super Admin only, irreversible.
// Requires the workshop already be in Trash — same two-step safety pattern
// used everywhere else in this app.
async function permanentlyDeleteWorkshop(req, res) {
  const before = await prisma.workshop.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Workshop not found');
  if (!before.deletedAt) throw new ApiError(400, 'This workshop is not in Trash — move it to Trash first');
  await prisma.workshop.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'PERMANENTLY_DELETED', module: 'WORKSHOP', entityId: before.id, entityLabel: before.topic, before });
  return sendSuccess(res, 200, { message: 'Workshop permanently deleted' });
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

// `scope` mirrors the Departments/Projects/Colleges/Workshops Active/All/
// Trash convention, applied to the new deletedAt column (see schema.prisma).
function mouScopeWhere(scope) {
  if (scope === 'trash') return { deletedAt: { not: null } };
  if (scope === 'all') return {};
  return { deletedAt: null };
}

async function listMous(req, res) {
  const { status, collegeId, assignedEmployeeId, search, scope } = req.query;
  const mous = await prisma.mOU.findMany({
    where: {
      ...mouScopeWhere(scope),
      ...(status && { status }),
      ...(collegeId && { collegeId }),
      ...(assignedEmployeeId && { assignedEmployeeId }),
      ...(search && {
        OR: [
          { mouType: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { purpose: { contains: search, mode: 'insensitive' } },
        ],
      }),
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

// POST /api/mous/:id/document — attach/replace the signed MOU document.
// Reuses the same upload middleware/storage convention as intern documents
// (middleware/upload.js); the old file is removed when a document is replaced,
// mirroring document.controller.js's uploadDocument re-upload behavior.
async function uploadMouDocument(req, res) {
  const before = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'MOU not found');
  if (!req.file) throw new ApiError(400, 'A file is required');

  if (before.documentPath) {
    fs.unlink(before.documentPath, () => {});
  }

  const mou = await prisma.mOU.update({
    where: { id: req.params.id },
    data: { documentPath: req.file.path, documentName: req.file.originalname },
  });
  await recordAudit({ actorId: req.user.id, action: 'DOCUMENT_UPLOADED', module: 'MOU', entityId: mou.id, entityLabel: mou.mouType || mou.id, before, after: mou });
  return sendSuccess(res, 200, mou);
}

// GET /api/mous/:id/document — download the attached MOU document
async function downloadMouDocument(req, res) {
  const mou = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!mou) throw new ApiError(404, 'MOU not found');
  if (!mou.documentPath) throw new ApiError(404, 'No document attached to this MOU');
  return res.download(path.resolve(mou.documentPath), mou.documentName || 'mou-document');
}

// GET /api/mous/summary — real counts for the summary cards.
async function mouSummary(req, res) {
  const [total, trash] = await Promise.all([
    prisma.mOU.count({ where: { deletedAt: null } }),
    prisma.mOU.count({ where: { deletedAt: { not: null } } }),
  ]);
  return sendSuccess(res, 200, { total, trash });
}

// DELETE /api/mous/:id — Super Admin only, soft delete (was previously a
// hard delete). Mirrors Departments/Projects/Colleges/Workshops' soft delete.
async function deleteMou(req, res) {
  const before = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'MOU not found');
  if (before.deletedAt) throw new ApiError(400, 'This MOU is already in Trash');
  const mou = await prisma.mOU.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'MOU', entityId: before.id, entityLabel: before.mouType || before.id, before, after: mou });
  return sendSuccess(res, 200, { message: 'MOU moved to Trash' });
}

// POST /api/mous/:id/restore — Super Admin only (same gate as delete).
async function restoreMou(req, res) {
  const before = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'MOU not found');
  if (!before.deletedAt) throw new ApiError(400, 'This MOU is not in Trash');
  const mou = await prisma.mOU.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await recordAudit({ actorId: req.user.id, action: 'RESTORED', module: 'MOU', entityId: before.id, entityLabel: before.mouType || before.id, before, after: mou });
  return sendSuccess(res, 200, mou);
}

// DELETE /api/mous/:id/permanent — Super Admin only, irreversible. Requires
// the MOU already be in Trash — same two-step safety pattern used
// everywhere else in this app.
async function permanentlyDeleteMou(req, res) {
  const before = await prisma.mOU.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'MOU not found');
  if (!before.deletedAt) throw new ApiError(400, 'This MOU is not in Trash — move it to Trash first');
  await prisma.mOU.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'PERMANENTLY_DELETED', module: 'MOU', entityId: before.id, entityLabel: before.mouType || before.id, before });
  return sendSuccess(res, 200, { message: 'MOU permanently deleted' });
}

module.exports = {
  listColleges, collegeSummary, getCollege, createCollege, updateCollege, deleteCollege, restoreCollege, permanentlyDeleteCollege,
  createCollegeDepartment, updateCollegeDepartment, deleteCollegeDepartment,
  listWorkshops, workshopSummary, getWorkshop, createWorkshop, updateWorkshop, deleteWorkshop, restoreWorkshop, permanentlyDeleteWorkshop,
  listMous, mouSummary, getMou, createMou, updateMou, deleteMou, restoreMou, permanentlyDeleteMou, uploadMouDocument, downloadMouDocument,
};
