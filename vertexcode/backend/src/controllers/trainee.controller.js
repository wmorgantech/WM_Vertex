const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// --- Training Programs -------------------------------------------------------

async function listPrograms(req, res) {
  const programs = await prisma.trainingProgram.findMany({
    include: {
      trainer: { select: { id: true, firstName: true, lastName: true } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { enrollments: true, topics: true } },
    },
    orderBy: { startDate: 'desc' },
  });
  return sendSuccess(res, 200, programs);
}

async function getProgram(req, res) {
  const program = await prisma.trainingProgram.findUnique({
    where: { id: req.params.id },
    include: {
      trainer: { select: { id: true, firstName: true, lastName: true } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
      topics: { where: { active: true }, orderBy: { sequence: 'asc' } },
      enrollments: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } } },
      },
    },
  });
  if (!program) throw new ApiError(404, 'Training program not found');
  return sendSuccess(res, 200, program);
}

async function createProgram(req, res) {
  const { name, description, technology, duration, totalSessions, trainerId, mentorId, fee, discount, finalFee, startDate, endDate, status } = req.body;
  if (!name || !trainerId || !startDate || !endDate) {
    throw new ApiError(400, 'name, trainerId, startDate and endDate are required');
  }
  const program = await prisma.trainingProgram.create({
    data: {
      name, description, technology, duration,
      totalSessions: totalSessions ?? null,
      trainerId,
      mentorId: mentorId || null,
      fee: fee ?? null,
      discount: discount ?? null,
      finalFee: finalFee ?? null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status || 'UPCOMING',
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'TRAINING_PROGRAM', entityId: program.id, entityLabel: program.name, after: program });
  return sendSuccess(res, 201, program);
}

async function updateProgram(req, res) {
  const before = await prisma.trainingProgram.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Training program not found');
  const { name, description, technology, duration, totalSessions, trainerId, mentorId, fee, discount, finalFee, startDate, endDate, status } = req.body;
  const program = await prisma.trainingProgram.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(technology !== undefined && { technology }),
      ...(duration !== undefined && { duration }),
      ...(totalSessions !== undefined && { totalSessions }),
      ...(trainerId !== undefined && { trainerId }),
      ...(mentorId !== undefined && { mentorId: mentorId || null }),
      ...(fee !== undefined && { fee }),
      ...(discount !== undefined && { discount }),
      ...(finalFee !== undefined && { finalFee }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(status !== undefined && { status }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'TRAINING_PROGRAM', entityId: program.id, entityLabel: program.name, before, after: program });
  return sendSuccess(res, 200, program);
}

async function deleteProgram(req, res) {
  const before = await prisma.trainingProgram.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Training program not found');
  await prisma.trainingProgram.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'TRAINING_PROGRAM', entityId: before.id, entityLabel: before.name, before });
  return sendSuccess(res, 200, { message: 'Training program removed' });
}

// --- Training Topics -----------------------------------------------------------

async function listTopics(req, res) {
  const { programId } = req.query;
  if (!programId) throw new ApiError(400, 'programId is required');
  const topics = await prisma.trainingTopic.findMany({ where: { programId }, orderBy: { sequence: 'asc' } });
  return sendSuccess(res, 200, topics);
}

async function createTopic(req, res) {
  const { programId, topic, description, sequence, expectedDurationHours, trainingMaterial } = req.body;
  if (!programId || !topic) throw new ApiError(400, 'programId and topic are required');
  const row = await prisma.trainingTopic.create({
    data: { programId, topic, description, sequence: sequence ?? 0, expectedDurationHours, trainingMaterial },
  });
  return sendSuccess(res, 201, row);
}

async function updateTopic(req, res) {
  const { topic, description, sequence, expectedDurationHours, trainingMaterial, active } = req.body;
  const row = await prisma.trainingTopic.update({
    where: { id: req.params.id },
    data: {
      ...(topic !== undefined && { topic }),
      ...(description !== undefined && { description }),
      ...(sequence !== undefined && { sequence }),
      ...(expectedDurationHours !== undefined && { expectedDurationHours }),
      ...(trainingMaterial !== undefined && { trainingMaterial }),
      ...(active !== undefined && { active }),
    },
  });
  return sendSuccess(res, 200, row);
}

async function deleteTopic(req, res) {
  await prisma.trainingTopic.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Topic removed' });
}

// --- Trainee Enrollments --------------------------------------------------------

async function listEnrollments(req, res) {
  const { programId, mentorId, completionStatus } = req.query;

  // SUPER_ADMIN: unrestricted. ADMIN: only trainees they mentor. TRAINEE: only their own.
  let where;
  if (req.user.role === 'SUPER_ADMIN') {
    where = {
      ...(programId && { programId }),
      ...(mentorId && { mentorId }),
      ...(completionStatus && { completionStatus }),
    };
  } else if (req.user.role === 'ADMIN') {
    where = {
      mentorId: req.user.id,
      ...(programId && { programId }),
      ...(completionStatus && { completionStatus }),
    };
  } else {
    where = { userId: req.user.id };
  }

  const enrollments = await prisma.traineeEnrollment.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      program: true,
      mentor: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, 200, enrollments);
}

function assertTraineeAccess(req, enrollment) {
  if (req.user.role === 'SUPER_ADMIN') return;
  if (req.user.role === 'ADMIN') {
    if (enrollment.mentorId !== req.user.id) throw new ApiError(403, 'You can only access trainees assigned to you');
    return;
  }
  if (req.user.role === 'TRAINEE' && enrollment.userId === req.user.id) return;
  throw new ApiError(403, 'You do not have permission to access this record');
}

// GET /api/trainees/enrollments/:id — full detail incl. topic progress & payments
async function getEnrollment(req, res) {
  const enrollment = await prisma.traineeEnrollment.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      program: { include: { topics: { where: { active: true }, orderBy: { sequence: 'asc' } } } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
      topicProgress: true,
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertTraineeAccess(req, enrollment);

  const totalTopics = enrollment.program.topics.length;
  const progressByTopic = new Map(enrollment.topicProgress.map((p) => [p.topicId, p]));
  const completedTopics = enrollment.topicProgress.filter((p) => p.status === 'COMPLETED').length;
  const assignmentsCompleted = enrollment.topicProgress.filter((p) => p.assignmentStatus === 'REVIEWED').length;
  const assignmentsPending = enrollment.topicProgress.filter((p) => p.assignmentStatus !== 'REVIEWED').length;
  const currentTopic = enrollment.program.topics.find((t) => (progressByTopic.get(t.id)?.status || 'NOT_STARTED') !== 'COMPLETED');

  const totalPaid = enrollment.payments.reduce((sum, p) => sum + p.amount, 0);
  const finalFee = enrollment.finalFee ?? enrollment.program.finalFee ?? 0;
  const balance = Math.max(finalFee - totalPaid, 0);

  return sendSuccess(res, 200, {
    ...enrollment,
    progress: {
      totalTopics,
      completedTopics,
      pendingTopics: totalTopics - completedTopics,
      completionPercent: totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0,
      currentTopic: currentTopic ? { id: currentTopic.id, topic: currentTopic.topic } : null,
      assignmentsCompleted,
      assignmentsPending,
    },
    payment: { totalPaid, finalFee, balance },
  });
}

async function enrollTrainee(req, res) {
  const { userId, programId, mentorId, education, qualification, experienceYears, trainingStartDate, trainingEndDate, totalFee, discount, finalFee, notes } = req.body;
  if (!userId || !programId) throw new ApiError(400, 'userId and programId are required');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found');

  const enrollment = await prisma.traineeEnrollment.create({
    data: {
      userId, programId, mentorId: mentorId || null, education, qualification,
      experienceYears: experienceYears ?? null,
      trainingStartDate: trainingStartDate ? new Date(trainingStartDate) : null,
      trainingEndDate: trainingEndDate ? new Date(trainingEndDate) : null,
      totalFee: totalFee ?? null, discount: discount ?? null, finalFee: finalFee ?? null, notes,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { role: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? user.role : 'TRAINEE', employmentType: 'TRAINEE' },
  });

  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'TRAINEE_ENROLLMENT', entityId: enrollment.id, entityLabel: `${user.firstName} ${user.lastName}`, after: enrollment });
  return sendSuccess(res, 201, enrollment);
}

async function updateEnrollment(req, res) {
  const before = await prisma.traineeEnrollment.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Enrollment not found');
  assertTraineeAccess(req, before);

  const { mentorId, completionStatus, trainingStartDate, trainingEndDate, totalFee, discount, finalFee, notes } = req.body;
  const enrollment = await prisma.traineeEnrollment.update({
    where: { id: req.params.id },
    data: {
      ...(mentorId !== undefined && { mentorId: mentorId || null }),
      ...(completionStatus && { completionStatus }),
      ...(trainingStartDate !== undefined && { trainingStartDate: trainingStartDate ? new Date(trainingStartDate) : null }),
      ...(trainingEndDate !== undefined && { trainingEndDate: trainingEndDate ? new Date(trainingEndDate) : null }),
      ...(totalFee !== undefined && { totalFee }),
      ...(discount !== undefined && { discount }),
      ...(finalFee !== undefined && { finalFee }),
      ...(notes !== undefined && { notes }),
    },
  });

  if (completionStatus === 'CONVERTED_TO_EMPLOYEE') {
    await prisma.user.update({ where: { id: before.userId }, data: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' } });
  }

  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'TRAINEE_ENROLLMENT', entityId: enrollment.id, before, after: enrollment });
  return sendSuccess(res, 200, enrollment);
}

// PUT /api/trainees/enrollments/me — Trainee self-service profile update
const SELF_FIELDS = ['education', 'qualification', 'experienceYears'];
async function updateMyEnrollment(req, res) {
  const enrollment = await prisma.traineeEnrollment.findUnique({ where: { userId: req.user.id } });
  if (!enrollment) throw new ApiError(404, 'No training enrollment found. Contact an admin to be enrolled in a program.');

  const data = {};
  for (const f of SELF_FIELDS) {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  }
  const updated = await prisma.traineeEnrollment.update({ where: { userId: req.user.id }, data });
  return sendSuccess(res, 200, updated);
}

// PATCH /api/trainees/enrollments/:id/topics/:topicId — set a trainee's progress on one topic
async function updateTopicProgress(req, res) {
  const { status, assignmentStatus, remarks } = req.body;
  const enrollment = await prisma.traineeEnrollment.findUnique({ where: { id: req.params.id } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertTraineeAccess(req, enrollment);

  const row = await prisma.traineeTopicProgress.upsert({
    where: { enrollmentId_topicId: { enrollmentId: req.params.id, topicId: req.params.topicId } },
    update: {
      ...(status && { status, ...(status === 'COMPLETED' && { completedAt: new Date() }) }),
      ...(assignmentStatus && { assignmentStatus }),
      ...(remarks !== undefined && { remarks }),
    },
    create: {
      enrollmentId: req.params.id,
      topicId: req.params.topicId,
      status: status || 'NOT_STARTED',
      assignmentStatus: assignmentStatus || 'NOT_SUBMITTED',
      remarks,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
  });

  // Keep the denormalized progressPercent in sync for list views/dashboards.
  const [totalTopics, completedTopics] = await Promise.all([
    prisma.trainingTopic.count({ where: { programId: enrollment.programId, active: true } }),
    prisma.traineeTopicProgress.count({ where: { enrollmentId: req.params.id, status: 'COMPLETED' } }),
  ]);
  await prisma.traineeEnrollment.update({
    where: { id: req.params.id },
    data: { progressPercent: totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0 },
  });

  return sendSuccess(res, 200, row);
}

// --- Training Sessions (daily tracking) -----------------------------------------

async function listSessions(req, res) {
  const { programId } = req.query;
  if (!programId) throw new ApiError(400, 'programId is required');
  const sessions = await prisma.trainingSession.findMany({
    where: { programId },
    include: {
      topic: { select: { id: true, topic: true } },
      trainer: { select: { id: true, firstName: true, lastName: true } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });
  return sendSuccess(res, 200, sessions);
}

async function createSession(req, res) {
  const { programId, topicId, trainerId, mentorId, date, startTime, endTime, topicsCovered, topicsPending, trainingMaterial, remarks } = req.body;
  if (!programId || !trainerId || !date) throw new ApiError(400, 'programId, trainerId and date are required');

  const session = await prisma.trainingSession.create({
    data: {
      programId, topicId: topicId || null, trainerId, mentorId: mentorId || null,
      date: new Date(date),
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      topicsCovered, topicsPending, trainingMaterial, remarks,
    },
  });
  return sendSuccess(res, 201, session);
}

// --- Payments --------------------------------------------------------------------

async function listPayments(req, res) {
  const enrollment = await prisma.traineeEnrollment.findUnique({ where: { id: req.params.enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertTraineeAccess(req, enrollment);
  const payments = await prisma.traineePayment.findMany({
    where: { enrollmentId: req.params.enrollmentId },
    orderBy: { paymentDate: 'desc' },
  });
  return sendSuccess(res, 200, payments);
}

async function addPayment(req, res) {
  const { amount, paymentDate, paymentMode, reference, notes } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, 'A positive amount is required');

  const enrollment = await prisma.traineeEnrollment.findUnique({ where: { id: req.params.enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');

  const payment = await prisma.traineePayment.create({
    data: {
      enrollmentId: req.params.enrollmentId,
      amount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode, reference, notes,
      recordedById: req.user.id,
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'TRAINEE_PAYMENT', entityId: payment.id, entityLabel: `₹${amount}`, after: payment });
  return sendSuccess(res, 201, payment);
}

module.exports = {
  listPrograms, getProgram, createProgram, updateProgram, deleteProgram,
  listTopics, createTopic, updateTopic, deleteTopic,
  listEnrollments, getEnrollment, enrollTrainee, updateEnrollment, updateMyEnrollment, updateTopicProgress,
  listSessions, createSession,
  listPayments, addPayment,
};
